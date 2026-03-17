import { useState, useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hexToRgba } from '../../utils/colorUtils';
import { generateTextExport, generatePngExport } from '../../utils/matchExport';
import { FORMATIONS } from '../../constants/formations';

interface MatchExportDialogProps {
  onClose: () => void;
}

export function MatchExportDialog({ onClose }: MatchExportDialogProps) {
  const { state } = useAppState();
  const theme = useThemeColors();
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const plan = state.matchPlan;
  if (!plan) return null;

  const formationName = FORMATIONS.find(f => f.id === state.teamAFormation)?.name ?? state.teamAFormation ?? 'Custom';

  const handleTextExport = async () => {
    setExporting('text');
    try {
      const text = generateTextExport(plan, state.teamAName, state.teamBName, formationName);
      await navigator.clipboard.writeText(text);
      setToast('Copied to clipboard!');
      setTimeout(() => setToast(null), 2000);
    } catch {
      // Fallback: open in new window
      const text = generateTextExport(plan, state.teamAName, state.teamBName, formationName);
      const win = window.open('', '_blank');
      if (win) {
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        win.document.write(`<pre style="font-family:monospace;white-space:pre-wrap">${escaped}</pre>`);
      }
    }
    setExporting(null);
  };

  const handlePngExport = async () => {
    setExporting('png');
    try {
      const blob = await generatePngExport(plan, state.teamAName, state.teamBName, state.teamAColor, formationName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `match-plan-${state.teamAName.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setToast('PNG downloaded!');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error('PNG export failed:', err);
      setToast('Export failed');
      setTimeout(() => setToast(null), 2000);
    }
    setExporting(null);
  };

  const handlePdfExport = async () => {
    setExporting('pdf');
    try {
      // Use text-based PDF (no jsPDF dependency) — generate HTML and print
      const text = generateTextExport(plan, state.teamAName, state.teamBName, formationName);
      // Strip first 3 lines (title, config, blank) — already shown in the HTML header
      const textForPdf = text.split('\n').slice(3).join('\n');
      const win = window.open('', '_blank');
      if (win) {
        // Escape HTML to prevent XSS from user-provided team names
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeTeamA = esc(state.teamAName);
        const safeTeamB = esc(state.teamBName);
        const safeFormation = esc(formationName);
        const safeText = esc(textForPdf);
        win.document.write(`
          <html>
          <head>
            <title>Match Plan - ${safeTeamA}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; color: #222; max-width: 700px; margin: 0 auto; }
              h1 { font-size: 22px; margin: 0 0 2px; }
              .subtitle { font-size: 14px; color: #444; margin: 2px 0 4px; }
              .meta { font-size: 13px; color: #666; margin-bottom: 24px; }
              pre { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.8; white-space: pre-wrap; }
              .branding { margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <h1>${safeTeamA} vs ${safeTeamB}</h1>
            <div class="subtitle">Squad Plan Summary</div>
            <div class="meta">${plan.ruleMode === 'fifa-standard' ? 'FIFA Standard' : 'Free Subs'} | ${safeFormation} | ${plan.hasExtraTime ? '120' : '90'} min</div>
            <pre>${safeText}</pre>
            <div class="branding">Football Tactics Studio — football-tactics-studio.com</div>
            <script>window.print();</script>
          </body>
          </html>
        `);
      }
      setToast('PDF print dialog opened!');
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast('Export failed');
      setTimeout(() => setToast(null), 2000);
    }
    setExporting(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 0,
          width: 320,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.secondary }}>
            Export Match Plan
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: theme.textSubtle, cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* Export options */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ExportButton
            label="Copy as Text"
            description="Plain text for notes, emails, or chat"
            icon="T"
            loading={exporting === 'text'}
            onClick={handleTextExport}
          />
          <ExportButton
            label="Download PNG"
            description="Image for WhatsApp, messaging apps"
            icon="I"
            loading={exporting === 'png'}
            onClick={handlePngExport}
          />
          <ExportButton
            label="Print / PDF"
            description="Opens print dialog for match day handouts"
            icon="P"
            loading={exporting === 'pdf'}
            onClick={handlePdfExport}
          />
        </div>

        {/* Toast */}
        {toast && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: `1px solid ${theme.border}`,
              fontSize: 11,
              color: '#22c55e',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function ExportButton({
  label,
  description,
  icon,
  loading,
  onClick,
}: {
  label: string;
  description: string;
  icon: string;
  loading: boolean;
  onClick: () => void;
}) {
  const theme = useThemeColors();

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${theme.borderSubtle}`,
        borderRadius: 6,
        background: 'transparent',
        color: theme.secondary,
        cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        if (!loading) {
          e.currentTarget.style.borderColor = theme.highlight;
          e.currentTarget.style.background = hexToRgba(theme.highlight, 0.06);
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = theme.borderSubtle;
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: hexToRgba(theme.highlight, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: theme.highlight,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: theme.textSubtle }}>{description}</div>
      </div>
    </button>
  );
}
