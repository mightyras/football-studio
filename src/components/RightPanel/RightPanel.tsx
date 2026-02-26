import { SettingsPanel } from '../SettingsPanel/SettingsPanel';
import { ScenesPanel } from '../ScenesPanel/ScenesPanel';
import { HelpPanel } from '../HelpPanel/HelpPanel';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { PanelTab, PitchRotation } from '../../types';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '8px 4px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        border: 'none',
        borderBottom: active ? `2px solid ${theme.highlight}` : '2px solid transparent',
        background: 'transparent',
        color: active ? theme.highlight : theme.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

interface RightPanelProps {
  rotation: PitchRotation;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  saveRequested?: boolean;
  onSaveHandled?: () => void;
  onRequestSignIn?: () => void;
  onStartCollaboration?: (boardId: string, isOwner: boolean, permission: 'view' | 'edit' | 'owner') => void;
  onStartTour?: () => void;
}

export function RightPanel({ rotation, activeTab, onTabChange, saveRequested, onSaveHandled, onRequestSignIn, onStartCollaboration, onStartTour }: RightPanelProps) {
  const theme = useThemeColors();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: theme.surface,
        borderLeft: `1px solid ${theme.border}`,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Tab bar — only shown for settings; boards & help have their own TopBar icons */}
      {activeTab === 'settings' && (
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${theme.border}`,
            flexShrink: 0,
          }}
        >
          <TabButton
            active
            onClick={() => onTabChange('settings')}
          >
            Settings
          </TabButton>
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'settings' ? (
          <SettingsPanel rotation={rotation} />
        ) : activeTab === 'scenes' ? (
          <ScenesPanel saveRequested={saveRequested} onSaveHandled={onSaveHandled} onRequestSignIn={onRequestSignIn} onStartCollaboration={onStartCollaboration} />
        ) : (
          <HelpPanel onStartTour={onStartTour} />
        )}
      </div>
    </div>
  );
}
