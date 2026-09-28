import React, { useEffect, useState } from 'react';
import {
  type Look,
  type LookbookItem,
  type CultureCard,
  type AIStatus,
  type CommandAction,
  type CommandPayload,
} from '@dangviet/contracts';
import {
  fetchMeta,
  fetchLook,
  sendCommand,
  undoLook,
  fetchLookbook,
  saveToLookbook,
  deleteFromLookbook,
  fetchCultureCards,
  fetchAIStatus,
  sendAIChat,
  requestAIDesign,
} from './api/client.ts';
import { Navbar } from './components/Navbar.tsx';
import { ExploreSection } from './components/ExploreSection.tsx';
import { OutfitRoom } from './components/OutfitRoom.tsx';
import { DesignStudio } from './components/DesignStudio.tsx';
import { LookbookSection } from './components/LookbookSection.tsx';
import { CompareModal } from './components/CompareModal.tsx';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'explore' | 'studio' | 'design' | 'lookbook'>('explore');
  const [meta, setMeta] = useState<any | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [cultureCards, setCultureCards] = useState<CultureCard[]>([]);
  const [lookbookItems, setLookbookItems] = useState<LookbookItem[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [compareData, setCompareData] = useState<{ lookA: any; lookB: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [metaData, initialLook, cultureData, lookbookData, aiStat] = await Promise.all([
          fetchMeta(),
          fetchLook('look_default_01'),
          fetchCultureCards('published'),
          fetchLookbook(),
          fetchAIStatus(),
        ]);

        setMeta(metaData);
        setLook(initialLook);
        setCultureCards(cultureData);
        setLookbookItems(lookbookData);
        setAiStatus(aiStat);
      } catch (err: any) {
        console.error('Initialization error:', err);
        setLoadError(err.message || 'Không thể kết nối đến máy chủ API Dáng Việt');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 1. Dispatch Command with revision verification
  const handleDispatchCommand = async (action: CommandAction, payload: any) => {
    if (!look) return;
    const commandId = crypto.randomUUID();
    const command: CommandPayload = {
      commandId,
      lookId: look.id,
      expectedRevision: look.revision,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await sendCommand(command);
      setLook(result.look);
    } catch (err: any) {
      console.error('Command error:', err);
      alert(`Lỗi thực hiện lệnh: ${err.message}`);
    }
  };

  // 2. Undo
  const handleUndo = async () => {
    if (!look) return;
    try {
      const res = await undoLook(look.id);
      setLook(res.look);
    } catch (err: any) {
      alert(`Lỗi hoàn tác: ${err.message}`);
    }
  };

  // 3. Reset Outfit
  const handleReset = async () => {
    await handleDispatchCommand('RESET_OUTFIT', {});
  };

  // 4. Save Current Look to Lookbook
  const handleSaveLookbook = async () => {
    if (!look) return;
    const newItem: LookbookItem = {
      id: `lookbook_${Date.now()}`,
      title: `${look.title} (v${look.revision})`,
      lookId: look.id,
      revision: look.revision,
      snapshotConfig: JSON.parse(JSON.stringify(look.config)),
      eventId: look.eventId,
      styleId: look.styleId,
      notes: look.explanation,
      createdAt: new Date().toISOString(),
    };

    await saveToLookbook(newItem);
    const updated = await fetchLookbook();
    setLookbookItems(updated);
  };

  // 5. Ask AI with Command Execution Loop
  const handleAskAI = async (message: string) => {
    if (!look) throw new Error('Chưa tải bộ phối');
    const res = await sendAIChat(look.id, message, []);

    // If AI generated valid commands, dispatch them sequentially!
    if (res.commands && res.commands.length > 0) {
      let currentRev = look.revision;
      let updatedLook = look;

      for (const cmd of res.commands) {
        cmd.expectedRevision = currentRev;
        const cmdRes = await sendCommand(cmd);
        updatedLook = cmdRes.look;
        currentRev = cmdRes.newRevision;
      }
      setLook(updatedLook);
    }

    return {
      reply: res.reply,
      explanation: res.explanation,
      citations: res.citations,
    };
  };

  // 6. Delete Lookbook item
  const handleDeleteLookbookItem = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bộ phối này khỏi Lookbook?')) return;
    await deleteFromLookbook(id);
    setLookbookItems((prev) => prev.filter((x) => x.id !== id));
  };

  // 7. Open Compare Modal for two presets or looks
  const handleOpenStudioCompare = () => {
    if (!look || !meta || !meta.presets) return;
    const altPreset = meta.presets.find((p: any) => p.id !== look.id) || meta.presets[1] || meta.presets[0];
    setCompareData({
      lookA: { title: `${look.title} (Hiện tại)`, config: look.config },
      lookB: { title: `${altPreset.title} (Gợi ý đối sánh)`, config: altPreset.config },
    });
  };

  const handleCompareLookbookItems = (itemA: LookbookItem, itemB: LookbookItem) => {
    setCompareData({
      lookA: { title: itemA.title, config: itemA.snapshotConfig },
      lookB: { title: itemB.title, config: itemB.snapshotConfig },
    });
  };

  if (loadError) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Không thể khởi động Dáng Việt</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{loadError}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Hãy kiểm tra xem máy chủ backend API (port 3001) đã được chạy chưa bằng lệnh: <br />
          <code>npm run dev:server</code> hoặc <code>npm run setup</code>
        </p>
      </div>
    );
  }

  if (isLoading || !look || !meta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-red)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Đang khởi tạo không gian Dáng Việt...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} aiStatus={aiStatus} />

      <main style={{ flex: 1 }}>
        {currentTab === 'explore' && (
          <ExploreSection
            events={meta.events}
            presets={meta.presets}
            cultureCards={cultureCards}
            onSelectEvent={(eventId) => {
              setCurrentTab('studio');
              handleDispatchCommand('SET_EVENT', { eventId });
            }}
            onApplyPreset={(preset) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_PRESET', {
                config: preset.config,
                title: preset.title,
                explanation: preset.explanation,
                force: true,
              });
            }}
          />
        )}

        {currentTab === 'studio' && (
          <OutfitRoom
            look={look}
            events={meta.events}
            styles={meta.styles}
            colors={meta.colors}
            catalog={meta.catalog}
            onDispatchCommand={handleDispatchCommand}
            onUndo={handleUndo}
            onReset={handleReset}
            onSaveLookbook={handleSaveLookbook}
            onOpenCompare={handleOpenStudioCompare}
            onAskAI={handleAskAI}
            isLoading={false}
          />
        )}

        {currentTab === 'design' && (
          <DesignStudio
            events={meta.events}
            styles={meta.styles}
            onRequestDesign={async (prompt, eventId, styleId) => {
              return requestAIDesign({ prompt, eventId: eventId as any, styleId: styleId as any, baseLookId: look.id });
            }}
            onSaveDesignToLookbook={async (title, config, explanation) => {
              const newItem: LookbookItem = {
                id: `lookbook_design_${Date.now()}`,
                title,
                lookId: look.id,
                revision: look.revision,
                snapshotConfig: config,
                eventId: look.eventId,
                styleId: look.styleId,
                notes: explanation,
                createdAt: new Date().toISOString(),
              };
              await saveToLookbook(newItem);
              const updated = await fetchLookbook();
              setLookbookItems(updated);
            }}
            onApplyToStudio={(config, title, explanation) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_DESIGN', { config, title, explanation, force: true });
            }}
          />
        )}

        {currentTab === 'lookbook' && (
          <LookbookSection
            lookbookItems={lookbookItems}
            onOpenInStudio={(item) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_DESIGN', {
                config: item.snapshotConfig,
                title: item.title,
                explanation: item.notes,
                force: true,
              });
            }}
            onDeleteItem={handleDeleteLookbookItem}
            onCompareTwo={handleCompareLookbookItems}
          />
        )}
      </main>

      {/* Side-by-side Comparison Modal */}
      {compareData && (
        <CompareModal
          lookA={compareData.lookA}
          lookB={compareData.lookB}
          onClose={() => setCompareData(null)}
        />
      )}
    </div>
  );
};
