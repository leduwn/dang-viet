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
  const [viewingDesignTitle, setViewingDesignTitle] = useState<string | null>(null);

  // Helper: Guard against stale responses overwriting newer displayed revision
  const updateLookSafe = (newLook: Look) => {
    setLook((prev) => {
      if (!prev) return newLook;
      if (newLook.revision < prev.revision) {
        console.warn(`Bỏ qua phản hồi cũ: revision ${newLook.revision} < đang hiển thị ${prev.revision}`);
        return prev;
      }
      return newLook;
    });
  };

  // Initialize data on mount: Core data first, AI status decoupled
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [metaData, initialLook, cultureData, lookbookData] = await Promise.all([
          fetchMeta(),
          fetchLook('look_default_01'),
          fetchCultureCards('all'),
          fetchLookbook(),
        ]);

        setMeta(metaData);
        setLook(initialLook);
        setCultureCards(cultureData);
        setLookbookItems(lookbookData);
        setIsLoading(false);

        // Fetch AI status independently so AI slowness/offline never blocks the UI
        fetchAIStatus()
          .then((stat) => setAiStatus(stat))
          .catch((aiErr) => {
            console.warn('AI status fetch warning:', aiErr);
            setAiStatus({
              configured: false,
              endpointConnected: false,
              modelVerified: false,
              mode: 'mock',
              provider: 'Offline / Không kết nối',
              model: 'dangviet-rules-v1',
              capabilities: { textChat: true, structuredCommands: true, imageGen: false },
              message: 'Không thể kết nối dịch vụ AI. Đang chạy Chế độ mô phỏng an toàn.',
            });
          });
      } catch (err: any) {
        console.error('Initialization error:', err);
        setLoadError(err.message || 'Không thể kết nối đến máy chủ API Dáng Việt');
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 1. Dispatch Command with revision verification & conflict recovery
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
      updateLookSafe(result.look);

      // Manage viewing design title state
      if (action === 'APPLY_DESIGN') {
        setViewingDesignTitle(payload.title || 'Thiết kế');
      } else if (action === 'RESET_OUTFIT') {
        setViewingDesignTitle(null);
      } else {
        setViewingDesignTitle((prev) => {
          if (!prev) return null;
          if (!prev.includes('(đã chỉnh sửa)')) return `${prev} (đã chỉnh sửa)`;
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Command error:', err);
      if (err.status === 409) {
        const freshLook = await fetchLook(look.id);
        updateLookSafe(freshLook);
        if (err.code === 'DUPLICATE_COMMAND_ID') {
          alert('Lệnh đã được ghi nhận trước đó (DUPLICATE_COMMAND_ID). Đã đồng bộ lại trạng thái mới nhất.');
        } else {
          alert(`Xung đột phiên bản (REVISION_CONFLICT): Trạng thái trên giao diện không khớp với máy chủ. Đã tự động tải lại phiên bản v${freshLook.revision}.`);
        }
      } else {
        alert(`Lỗi thực hiện lệnh: ${err.message}`);
      }
    }
  };

  // 2. Undo
  const handleUndo = async () => {
    if (!look) return;
    try {
      const res = await undoLook(look.id);
      updateLookSafe(res.look);
      setViewingDesignTitle((prev) => (prev ? `${prev} (đã hoàn tác)` : null));
    } catch (err: any) {
      alert(`Lỗi hoàn tác: ${err.message}`);
      const freshLook = await fetchLook(look.id);
      updateLookSafe(freshLook);
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

    try {
      await saveToLookbook(newItem);
      try {
        const updated = await fetchLookbook();
        setLookbookItems(updated);
        alert('Đã lưu thành công bộ phối vào Lookbook!');
      } catch (refetchErr: any) {
        console.error('Refetch lookbook error:', refetchErr);
        alert('Đã lưu thành công bộ phối vào cơ sở dữ liệu, nhưng chưa thể làm mới danh sách hiển thị. Vui lòng tải lại trang.');
      }
    } catch (err: any) {
      alert(`Lỗi lưu Lookbook: ${err.message}`);
      throw err;
    }
  };

  // 5. Ask AI with Command Execution Loop & strict sequential failure reporting
  const handleAskAI = async (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    if (!look) throw new Error('Chưa tải bộ phối');
    const res = await sendAIChat(look.id, message, history);

    let commandsStatus: 'none' | 'planned' | 'all_applied' | 'partially_applied' | 'failed' = 'none';

    if (res.commands && res.commands.length > 0) {
      commandsStatus = 'planned';
      const totalCmds = res.commands.length;
      let appliedCount = 0;

      for (let i = 0; i < totalCmds; i++) {
        const cmd = res.commands[i];
        try {
          // Do NOT mutate cmd.expectedRevision! Keep exact planned revision from server
          const cmdRes = await sendCommand(cmd);
          updateLookSafe(cmdRes.look);
          appliedCount++;
        } catch (err: any) {
          console.error(`AI plan command ${i + 1}/${totalCmds} failed:`, err);
          if (appliedCount > 0) {
            commandsStatus = 'partially_applied';
            alert(`Chỉ áp dụng thành công ${appliedCount}/${totalCmds} lệnh từ AI. Lỗi tại lệnh thứ ${i + 1}: ${err.message}`);
          } else {
            commandsStatus = 'failed';
            alert(`Không thể áp dụng lệnh từ AI (0/${totalCmds}): ${err.message}`);
          }
          if (err.status === 409) {
            const freshLook = await fetchLook(look.id);
            updateLookSafe(freshLook);
          }
          break; // Stop execution loop on first failure
        }
      }

      if (appliedCount === totalCmds) {
        commandsStatus = 'all_applied';
      }
    }

    return {
      reply: res.reply,
      explanation: res.explanation,
      citations: res.citations,
      mode: res.mode,
      model: res.model,
      commandsStatus,
    };
  };

  // 6. Delete Lookbook item
  const handleDeleteLookbookItem = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bộ phối này khỏi Lookbook?')) return;
    try {
      await deleteFromLookbook(id);
      setLookbookItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa mục Lookbook: ${err.message}`);
    }
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
            viewingDesignTitle={viewingDesignTitle}
          />
        )}

        {currentTab === 'design' && (
          <DesignStudio
            events={meta.events}
            styles={meta.styles}
            onRequestDesign={async (prompt, eventId, styleId) => {
              return requestAIDesign({ prompt, eventId: eventId as any, styleId: styleId as any, baseLookId: look.id });
            }}
            onSaveDesignToLookbook={async (title, config, explanation, eventId, styleId) => {
              const newItem: LookbookItem = {
                id: `lookbook_design_${Date.now()}`,
                title,
                lookId: look.id,
                revision: look.revision,
                snapshotConfig: config,
                eventId: (eventId || look.eventId) as any,
                styleId: (styleId || look.styleId) as any,
                notes: explanation,
                createdAt: new Date().toISOString(),
              };
              await saveToLookbook(newItem);
              try {
                const updated = await fetchLookbook();
                setLookbookItems(updated);
              } catch (refetchErr) {
                console.error('Refetch lookbook failed:', refetchErr);
                throw new Error('Đã lưu thiết kế vào cơ sở dữ liệu nhưng chưa thể làm mới danh sách Lookbook');
              }
            }}
            onApplyToStudio={(config, title, explanation, eventId, styleId) => {
              setCurrentTab('studio');
              handleDispatchCommand('APPLY_DESIGN', {
                config,
                title,
                explanation,
                eventId: eventId as any,
                styleId: styleId as any,
              });
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
                eventId: item.eventId,
                styleId: item.styleId,
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
