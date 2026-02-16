import { FormationPanel } from '../FormationPanel/FormationPanel';
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
        borderBottom: active ? `2px solid ${theme.accent}` : '2px solid transparent',
        background: 'transparent',
        color: active ? theme.accent : '#94a3b8',
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
}

export function RightPanel({ rotation, activeTab, onTabChange, saveRequested, onSaveHandled }: RightPanelProps) {

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#111827',
        borderLeft: '1px solid #1e293b',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        <TabButton
          active={activeTab === 'formations'}
          onClick={() => onTabChange('formations')}
        >
          Formations
        </TabButton>
        <TabButton
          active={activeTab === 'settings'}
          onClick={() => onTabChange('settings')}
        >
          Settings
        </TabButton>
        <TabButton
          active={activeTab === 'scenes'}
          onClick={() => onTabChange('scenes')}
        >
          Scenes
        </TabButton>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'formations' ? (
          <FormationPanel />
        ) : activeTab === 'settings' ? (
          <SettingsPanel rotation={rotation} />
        ) : activeTab === 'scenes' ? (
          <ScenesPanel saveRequested={saveRequested} onSaveHandled={onSaveHandled} />
        ) : (
          <HelpPanel />
        )}
      </div>
    </div>
  );
}
