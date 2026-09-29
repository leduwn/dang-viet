import React from 'react';
import { type AIStatus } from '@dangviet/contracts';
import { Sparkles, Compass, Shirt, Palette, Bookmark, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';

interface NavbarProps {
  currentTab: 'explore' | 'studio' | 'design' | 'lookbook' | 'inspector';
  onSelectTab: (tab: 'explore' | 'studio' | 'design' | 'lookbook' | 'inspector') => void;
  aiStatus: AIStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, aiStatus }) => {
  return (
    <header className="navbar">
      <div
        className="brand-wrapper"
        onClick={() => onSelectTab('explore')}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectTab('explore');
          }
        }}
        aria-label="Về trang Khám phá Dáng Việt"
      >
        <BrandLogo size={32} showWordmark={false} />
        <div className="brand-text">
          <h1>Dáng Việt</h1>
          <p>Khám phá Việt phục, tạo nên dáng riêng</p>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Điều hướng chính">
        <button
          className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
          onClick={() => onSelectTab('explore')}
        >
          <Compass size={17} />
          <span>Khám phá</span>
        </button>
        <button
          className={`nav-tab-btn ${currentTab === 'studio' ? 'active' : ''}`}
          onClick={() => onSelectTab('studio')}
        >
          <Shirt size={17} />
          <span>Phòng phối</span>
        </button>
        <button
          className={`nav-tab-btn ${currentTab === 'design' ? 'active' : ''}`}
          onClick={() => onSelectTab('design')}
        >
          <Palette size={17} />
          <span>Xưởng thiết kế</span>
        </button>
        <button
          className={`nav-tab-btn ${currentTab === 'lookbook' ? 'active' : ''}`}
          onClick={() => onSelectTab('lookbook')}
        >
          <Bookmark size={17} />
          <span>Lookbook</span>
        </button>
        <button
          className={`nav-tab-btn ${currentTab === 'inspector' ? 'active' : ''}`}
          onClick={() => onSelectTab('inspector')}
        >
          <ShieldCheck size={17} />
          <span>Thẩm định Avatar</span>
        </button>
      </nav>

      <div>
        {aiStatus ? (
          <div
            className={aiStatus.mode === 'live' ? 'status-badge-live' : 'status-badge-mock'}
            title={aiStatus.message || ''}
          >
            <span className="status-dot"></span>
            <Sparkles size={13} />
            <span>{aiStatus.mode === 'live' ? `AI Trực tuyến (${aiStatus.model})` : 'AI Mô phỏng (Mock)'}</span>
          </div>
        ) : (
          <div className="status-badge-mock">
            <span className="status-dot"></span>
            <span>Đang kiểm tra AI...</span>
          </div>
        )}
      </div>
    </header>
  );
};
