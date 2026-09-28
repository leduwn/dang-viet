import React, { useState } from 'react';
import {
  type Look,
  type EventItem,
  type StyleItem,
  type Color,
  type LockState,
  type CommandAction,
} from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import {
  Lock,
  Unlock,
  RotateCcw,
  Sparkles,
  Send,
  BookmarkPlus,
  GitCompare,
  Check,
  Info,
} from 'lucide-react';

interface OutfitRoomProps {
  look: Look;
  events: EventItem[];
  styles: StyleItem[];
  colors: Color[];
  catalog: any;
  onDispatchCommand: (action: CommandAction, payload: any) => Promise<void>;
  onUndo: () => Promise<void>;
  onReset: () => Promise<void>;
  onSaveLookbook: () => Promise<void>;
  onOpenCompare: () => void;
  onAskAI: (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<{ reply: string; explanation?: string; citations?: any[]; mode: 'mock' | 'live'; model: string; commandsStatus?: string }>;
  isLoading: boolean;
  viewingDesignTitle?: string | null;
}

export const OutfitRoom: React.FC<OutfitRoomProps> = ({
  look,
  events,
  styles,
  colors,
  catalog,
  onDispatchCommand,
  onUndo,
  onReset,
  onSaveLookbook,
  onOpenCompare,
  onAskAI,
  isLoading,
  viewingDesignTitle,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      citations?: any[];
      mode?: 'mock' | 'live';
      model?: string;
      commandsStatus?: string;
    }>
  >([
    {
      role: 'assistant',
      text: 'Xin chào! Mình là trợ lý Dáng Việt. Bạn có thể nói những yêu cầu như "Đổi quần sang màu trắng", "Thêm nón lá", "Phối cho mình bộ đi chơi Tết", hoặc "Giải thích nguồn gốc tay raglan" nhé!',
      mode: 'mock',
      model: 'dangviet-rules-v1',
    },
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'customize' | 'ai'>('customize');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCommand = async (action: CommandAction, payload: any) => {
    if (isMutating || isLoading) return;
    setIsMutating(true);
    try {
      await onDispatchCommand(action, payload);
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleLock = async (field: keyof LockState) => {
    if (isMutating || isLoading) return;
    setIsMutating(true);
    try {
      await onDispatchCommand('TOGGLE_LOCK', { field });
      showNotification(look.locks[field] ? `Đã mở khóa ${field}` : `Đã khóa ${field}`);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveLookbookAction = async () => {
    if (isSaving || isMutating || isLoading) return;
    setIsSaving(true);
    try {
      await onSaveLookbook();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAiThinking || isMutating) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    const nextHistory = [...chatHistory, { role: 'user' as const, text: userMsg }];
    setChatHistory(nextHistory);
    setIsAiThinking(true);

    // Send actual session history to server (only user/assistant roles)
    const historyPayload = nextHistory.slice(-6).map((h) => ({
      role: h.role,
      content: h.text,
    }));

    try {
      const res = await onAskAI(userMsg, historyPayload);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          citations: res.citations,
          mode: res.mode,
          model: res.model,
          commandsStatus: res.commandsStatus,
        },
      ]);
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `Có lỗi xảy ra: ${err.message}`, mode: 'mock', model: 'error' },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const accessoriesSet = new Set(look.config.accessories);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem', width: '100%' }}>
      {/* Top Banner / Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--text-primary)',
            color: 'white',
            padding: '0.65rem 1.5rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.88rem',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Check size={16} color="#4CAF50" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Studio 3-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 320px) minmax(340px, 1fr) minmax(320px, 360px)',
          gap: '1.5rem',
          alignItems: 'start',
        }}
        className="studio-grid"
      >
        {/* ======================================================== */}
        {/* COLUMN 1: CONTEXT, EVENTS, STYLES & CONTROLS */}
        {/* ======================================================== */}
        <div className="col-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card: Bối cảnh sự kiện */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Bối cảnh sự kiện
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {events.map((ev) => (
                <button
                  key={ev.id}
                  disabled={isMutating || isLoading}
                  onClick={() => handleCommand('SET_EVENT', { eventId: ev.id })}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${look.eventId === ev.id ? 'var(--accent-red)' : 'var(--border-light)'}`,
                    background: look.eventId === ev.id ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
                    color: look.eventId === ev.id ? 'var(--accent-red)' : 'var(--text-primary)',
                    fontWeight: look.eventId === ev.id ? 600 : 500,
                    textAlign: 'left',
                    fontSize: '0.88rem',
                    transition: 'all var(--transition-fast)',
                    cursor: (isMutating || isLoading) ? 'not-allowed' : 'pointer',
                    opacity: (isMutating || isLoading) ? 0.7 : 1,
                  }}
                >
                  {ev.name}
                </button>
              ))}
            </div>
          </div>

          {/* Card: Phong cách */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Định hình phong cách
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {styles.map((st) => (
                <button
                  key={st.id}
                  disabled={isMutating || isLoading}
                  onClick={() => handleCommand('SET_STYLE', { styleId: st.id })}
                  style={{
                    padding: '0.6rem 0.3rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${look.styleId === st.id ? 'var(--accent-blue)' : 'var(--border-light)'}`,
                    background: look.styleId === st.id ? 'var(--accent-blue-soft)' : 'var(--bg-surface)',
                    color: look.styleId === st.id ? 'var(--accent-blue)' : 'var(--text-primary)',
                    fontWeight: look.styleId === st.id ? 700 : 500,
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    cursor: (isMutating || isLoading) ? 'not-allowed' : 'pointer',
                    opacity: (isMutating || isLoading) ? 0.7 : 1,
                  }}
                >
                  {st.name}
                </button>
              ))}
            </div>
          </div>

          {/* Card: Giải thích & Ghi chú phối đồ */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Info size={16} className="text-accent-red" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ý nghĩa phối đồ & Văn hóa
              </h3>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {look.explanation || 'Bộ phối được cân bằng hài hòa giữa màu sắc và phom dáng.'}
            </p>
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Phiên bản hiện tại: <strong>v{look.revision}</strong>
            </div>
          </div>

          {/* Action Toolbar: Undo, Reset, Save, Compare */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              border: '1px solid var(--border-light)',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.6rem',
            }}
          >
            <button
              onClick={onUndo}
              disabled={look.revision <= 1 || isLoading || isMutating}
              style={{
                padding: '0.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                color: look.revision <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                border: '1px solid var(--border-light)',
                cursor: (look.revision <= 1 || isLoading || isMutating) ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCcw size={15} />
              <span>Hoàn tác</span>
            </button>

            <button
              onClick={onReset}
              disabled={isLoading || isMutating}
              style={{
                padding: '0.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                border: '1px solid var(--border-light)',
                cursor: (isLoading || isMutating) ? 'not-allowed' : 'pointer',
              }}
            >
              <Sparkles size={15} />
              <span>Đặt lại</span>
            </button>

            <button
              onClick={handleSaveLookbookAction}
              disabled={isLoading || isMutating || isSaving}
              style={{
                padding: '0.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-red)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                opacity: isSaving ? 0.7 : 1,
                cursor: (isLoading || isMutating || isSaving) ? 'not-allowed' : 'pointer',
              }}
            >
              <BookmarkPlus size={15} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Lookbook'}</span>
            </button>

            <button
              onClick={onOpenCompare}
              disabled={isLoading || isMutating}
              style={{
                padding: '0.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-blue)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: (isLoading || isMutating) ? 'not-allowed' : 'pointer',
              }}
            >
              <GitCompare size={15} />
              <span>So sánh 2 bộ</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: CENTERPIECE SVG MOCKUP */}
        {/* ======================================================== */}
        <div
          className="col-visualizer"
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem 1rem',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '620px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              display: 'flex',
              gap: '0.4rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {look.title}
            </span>

            {viewingDesignTitle && (
              <span
                style={{
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: 'var(--accent-blue-soft)',
                  color: 'var(--accent-blue)',
                  border: '1px solid var(--accent-blue)',
                }}
              >
                Đang xem thiết kế: {viewingDesignTitle}
              </span>
            )}
          </div>

          {/* SVG Visualizer */}
          <AoDaiVisualizer config={look.config} size="lg" />
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: CUSTOMIZATION PALETTES & AI DRAWER */}
        {/* ======================================================== */}
        <div className="col-customizer" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Mobile sub-tabs */}
          <div className="mobile-only" style={{ display: 'none', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={() => setMobileTab('customize')}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: mobileTab === 'customize' ? 'var(--accent-red)' : 'var(--bg-surface)',
                color: mobileTab === 'customize' ? 'white' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Tùy chọn trang phục
            </button>
            <button
              onClick={() => setMobileTab('ai')}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: mobileTab === 'ai' ? 'var(--accent-red)' : 'var(--bg-surface)',
                color: mobileTab === 'ai' ? 'white' : 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Trợ lý AI
            </button>
          </div>

          {/* SECTION: TÙY CHỌN CHI TIẾT (COLORS, FABRICS, ACCESSORIES) */}
          <div
            className={`section-customize ${mobileTab !== 'customize' ? 'tab-hidden' : ''}`}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              maxHeight: '440px',
              overflowY: 'auto',
            }}
          >
            {/* 1. MÀU ÁO (PRIMARY COLOR) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Màu áo: <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{look.config.primaryColor.name}</span>
                </label>
                <button
                  onClick={() => handleToggleLock('primaryColor')}
                  title={look.locks.primaryColor ? 'Mở khóa màu áo' : 'Khóa màu áo'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.72rem',
                    color: look.locks.primaryColor ? 'var(--accent-red)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {look.locks.primaryColor ? <Lock size={13} /> : <Unlock size={13} />}
                  <span>{look.locks.primaryColor ? 'Đã khóa' : 'Khóa'}</span>
                </button>
              </div>

              {/* Color Swatches Grid with Tooltip/Title & Keyboard Support */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                {colors.map((c) => {
                  const isSelected = look.config.primaryColor.hex.toLowerCase() === c.hex.toLowerCase();
                  const isDisabled = look.locks.primaryColor || isMutating || isLoading;
                  return (
                    <button
                      key={c.hex}
                      disabled={isDisabled}
                      onClick={() => handleCommand('SET_PRIMARY_COLOR', { color: c })}
                      title={c.name}
                      aria-label={`Chọn màu áo ${c.name}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: c.hex,
                        border: isSelected ? '3px solid var(--accent-red)' : '1px solid #D8D0C3',
                        boxShadow: isSelected ? '0 0 0 2px var(--bg-surface)' : 'none',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <Check size={14} color={c.family === 'white' || c.family === 'yellow' ? '#1E1B18' : '#FFFFFF'} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. MÀU QUẦN (PANTS COLOR) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Màu quần: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{look.config.pantsColor.name}</span>
                </label>
                <button
                  disabled={isMutating || isLoading}
                  onClick={() => handleToggleLock('pantsColor')}
                  title={look.locks.pantsColor ? 'Mở khóa màu quần' : 'Khóa màu quần'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.72rem',
                    color: look.locks.pantsColor ? 'var(--accent-red)' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: (isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {look.locks.pantsColor ? <Lock size={13} /> : <Unlock size={13} />}
                  <span>{look.locks.pantsColor ? 'Đã khóa' : 'Khóa'}</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                {colors.map((c) => {
                  const isSelected = look.config.pantsColor.hex.toLowerCase() === c.hex.toLowerCase();
                  const isDisabled = look.locks.pantsColor || isMutating || isLoading;
                  return (
                    <button
                      key={c.hex}
                      disabled={isDisabled}
                      onClick={() => handleCommand('SET_PANTS_COLOR', { color: c })}
                      title={c.name}
                      aria-label={`Chọn màu quần ${c.name}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: c.hex,
                        border: isSelected ? '3px solid var(--accent-blue)' : '1px solid #D8D0C3',
                        boxShadow: isSelected ? '0 0 0 2px var(--bg-surface)' : 'none',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <Check size={14} color={c.family === 'white' || c.family === 'yellow' ? '#1E1B18' : '#FFFFFF'} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. CỔ ÁO & TAY ÁO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Cổ áo
                </label>
                <select
                  value={look.config.collarStyle}
                  disabled={look.locks.collarStyle || isMutating || isLoading}
                  onChange={(e) => handleCommand('SET_COLLAR', { collarStyle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.8rem',
                    cursor: (look.locks.collarStyle || isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {catalog.collars.map((col: any) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Tay áo
                </label>
                <select
                  value={look.config.sleeveStyle}
                  disabled={look.locks.sleeveStyle || isMutating || isLoading}
                  onChange={(e) => handleCommand('SET_SLEEVE', { sleeveStyle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.8rem',
                    cursor: (look.locks.sleeveStyle || isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {catalog.sleeves.map((slv: any) => (
                    <option key={slv.id} value={slv.id}>{slv.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. CHẤT LIỆU VẢI & HỌA TIẾT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Chất liệu vải
                </label>
                <select
                  value={look.config.fabric}
                  disabled={look.locks.fabric || isMutating || isLoading}
                  onChange={(e) => handleCommand('SET_FABRIC', { fabric: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.8rem',
                    cursor: (look.locks.fabric || isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {catalog.fabrics.map((fab: any) => (
                    <option key={fab.id} value={fab.id}>{fab.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Họa tiết
                </label>
                <select
                  value={look.config.pattern}
                  disabled={look.locks.pattern || isMutating || isLoading}
                  onChange={(e) => handleCommand('SET_PATTERN', { pattern: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.8rem',
                    cursor: (look.locks.pattern || isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {catalog.patterns.map((pat: any) => (
                    <option key={pat.id} value={pat.id}>{pat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. PHỤ KIỆN TRUYỀN THỐNG & GEN Z */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Phụ kiện đi kèm ({accessoriesSet.size})
                </label>
                <button
                  disabled={isMutating || isLoading}
                  onClick={() => handleToggleLock('accessories')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.72rem',
                    color: look.locks.accessories ? 'var(--accent-red)' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: (isMutating || isLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {look.locks.accessories ? <Lock size={13} /> : <Unlock size={13} />}
                  <span>{look.locks.accessories ? 'Đã khóa' : 'Khóa'}</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                {catalog.accessories.map((acc: any) => {
                  const isChecked = accessoriesSet.has(acc.id);
                  const isDisabled = look.locks.accessories || isMutating || isLoading;
                  return (
                    <button
                      key={acc.id}
                      disabled={isDisabled}
                      onClick={() => handleCommand('TOGGLE_ACCESSORY', { accessoryId: acc.id })}
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isChecked ? 'var(--accent-red)' : 'var(--border-light)'}`,
                        background: isChecked ? 'var(--accent-red-soft)' : 'var(--bg-subtle)',
                        color: isChecked ? 'var(--accent-red)' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: isChecked ? 600 : 500,
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                    >
                      <span>{acc.name}</span>
                      {isChecked && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION: TRỢ LÝ AI (AI ASSISTANT CHAT & PROMPTS) */}
          {/* ======================================================== */}
          <div
            className={`section-ai ${mobileTab !== 'ai' ? 'tab-hidden' : ''}`}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              height: '340px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} className="text-accent-red" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Trợ lý Dáng Việt (AI Assistant)
              </h3>
            </div>

            {/* Chat History List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                paddingRight: '0.25rem',
                marginBottom: '0.75rem',
              }}
            >
              {chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                    background: item.role === 'user' ? 'var(--accent-red)' : 'var(--bg-subtle)',
                    color: item.role === 'user' ? 'white' : 'var(--text-primary)',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                  }}
                >
                  {item.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 'var(--radius-full)',
                          background: item.mode === 'live' ? 'var(--accent-blue-soft)' : 'var(--accent-red-soft)',
                          color: item.mode === 'live' ? 'var(--accent-blue)' : 'var(--accent-red)',
                          fontWeight: 700,
                        }}
                      >
                        {item.mode === 'live' ? `[Live: ${item.model}]` : `[Mô phỏng: ${item.model || 'Mock'}]`}
                      </span>
                      {item.commandsStatus && item.commandsStatus !== 'none' && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: 'var(--radius-full)',
                            background: item.commandsStatus === 'all_applied' ? '#E8F5E9' : item.commandsStatus === 'partially_applied' ? '#FFF3E0' : '#FFEBEE',
                            color: item.commandsStatus === 'all_applied' ? '#2E7D32' : item.commandsStatus === 'partially_applied' ? '#E65100' : '#C62828',
                            fontWeight: 600,
                          }}
                        >
                          Lệnh: {item.commandsStatus === 'all_applied' ? 'Đã áp dụng toàn bộ' : item.commandsStatus === 'partially_applied' ? 'Áp dụng một phần' : item.commandsStatus === 'failed' ? 'Thất bại' : 'Đã lên kế hoạch'}
                        </span>
                      )}
                    </div>
                  )}
                  <p>{item.text}</p>
                  {item.citations && item.citations.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.4rem',
                        paddingTop: '0.4rem',
                        borderTop: '1px solid rgba(0,0,0,0.1)',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <strong>Dẫn chứng:</strong> {item.citations[0].title} — {item.citations[0].source}
                    </div>
                  )}
                </div>
              ))}
              {isAiThinking && (
                <div style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  AI đang tư duy và tạo lệnh phối đồ...
                </div>
              )}
            </div>

            {/* Quick Action Suggestion Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
              <button
                onClick={() => { setChatInput('Đổi quần sang màu trắng'); }}
                style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
              >
                Đổi quần trắng
              </button>
              <button
                onClick={() => { setChatInput('Thêm nón lá bỏ túi cói'); }}
                style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
              >
                Thêm nón lá
              </button>
              <button
                onClick={() => { setChatInput('Giải thích nguồn gốc tay raglan'); }}
                style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
              >
                Hỏi nguồn gốc
              </button>
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Yêu cầu AI đổi màu, phụ kiện..."
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.82rem',
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAiThinking}
                style={{
                  padding: '0.55rem 0.85rem',
                  background: 'var(--accent-red)',
                  color: 'white',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
