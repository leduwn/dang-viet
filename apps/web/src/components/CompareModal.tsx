import React from 'react';
import { type GarmentConfig } from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer.tsx';
import { X } from 'lucide-react';

interface CompareModalProps {
  lookA: { title: string; config: GarmentConfig; eventName?: string; styleName?: string; explanation?: string };
  lookB: { title: string; config: GarmentConfig; eventName?: string; styleName?: string; explanation?: string };
  onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({ lookA, lookB, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(30, 27, 24, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-light)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            padding: '0.4rem',
            borderRadius: '50%',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--text-primary)' }}>
            So sánh trực quan hai phương án
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Đối chiếu phom dáng, hòa sắc và phụ kiện giữa hai bộ phối
          </p>
        </div>

        {/* Side-by-side Visualizers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid var(--border-light)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.25rem' }}>
              PHƯƠNG ÁN A
            </span>
            <h4 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '1rem', textAlign: 'center' }}>
              {lookA.title}
            </h4>
            <AoDaiVisualizer config={lookA.config} size="sm" />
          </div>

          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid var(--border-light)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.25rem' }}>
              PHƯƠNG ÁN B
            </span>
            <h4 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '1rem', textAlign: 'center' }}>
              {lookB.title}
            </h4>
            <AoDaiVisualizer config={lookB.config} size="sm" />
          </div>
        </div>

        {/* Detailed Comparison Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border-medium)' }}>
              <th style={{ padding: '0.65rem', textAlign: 'left', width: '25%' }}>Đặc tính</th>
              <th style={{ padding: '0.65rem', textAlign: 'left', width: '37.5%', color: 'var(--accent-red)' }}>Phương án A</th>
              <th style={{ padding: '0.65rem', textAlign: 'left', width: '37.5%', color: 'var(--accent-blue)' }}>Phương án B</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.65rem', fontWeight: 600 }}>Màu áo</td>
              <td style={{ padding: '0.65rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: lookA.config.primaryColor.hex, marginRight: '6px' }}></span>
                {lookA.config.primaryColor.name}
              </td>
              <td style={{ padding: '0.65rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: lookB.config.primaryColor.hex, marginRight: '6px' }}></span>
                {lookB.config.primaryColor.name}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.65rem', fontWeight: 600 }}>Màu quần</td>
              <td style={{ padding: '0.65rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: lookA.config.pantsColor.hex, marginRight: '6px', border: '1px solid #ccc' }}></span>
                {lookA.config.pantsColor.name}
              </td>
              <td style={{ padding: '0.65rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: lookB.config.pantsColor.hex, marginRight: '6px', border: '1px solid #ccc' }}></span>
                {lookB.config.pantsColor.name}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.65rem', fontWeight: 600 }}>Cổ & Tay áo</td>
              <td style={{ padding: '0.65rem' }}>{lookA.config.collarStyle} / {lookA.config.sleeveStyle}</td>
              <td style={{ padding: '0.65rem' }}>{lookB.config.collarStyle} / {lookB.config.sleeveStyle}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.65rem', fontWeight: 600 }}>Chất liệu & Họa tiết</td>
              <td style={{ padding: '0.65rem' }}>{lookA.config.fabric} / {lookA.config.pattern}</td>
              <td style={{ padding: '0.65rem' }}>{lookB.config.fabric} / {lookB.config.pattern}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '0.65rem', fontWeight: 600 }}>Phụ kiện</td>
              <td style={{ padding: '0.65rem' }}>{lookA.config.accessories.join(', ') || 'Không có'}</td>
              <td style={{ padding: '0.65rem' }}>{lookB.config.accessories.join(', ') || 'Không có'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
