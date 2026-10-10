import React, { useState, useEffect, useRef } from 'react';
import {
  type Look,
  type GarmentConfig,
  type AIImageJob,
  type AIImageStylePreset,
  type EventItem,
  type StyleItem,
  type FaceReferenceItem,
} from '@dangviet/contracts';
import {
  requestAIImage,
  fetchAIImageJobs,
  deleteAIImage,
  uploadFaceReference,
  deleteFaceReference,
  editAIImage,
  fetchAIImageLineage,
  ApiError,
} from '../api/client.ts';
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Download,
  BookmarkPlus,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Layers,
  Info,
  Upload,
  User,
  Camera,
  MessageSquare,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface AIImageStudioProps {
  currentLook: Look;
  events: EventItem[];
  styles: StyleItem[];
  onApplyConfigToStudio: (config: GarmentConfig, title: string, explanation: string) => void;
  onSaveImageToLookbook: (item: {
    title: string;
    config: GarmentConfig;
    explanation: string;
    resourceType?: 'svg_2d' | 'ai_prompt_image' | 'ai_face_ref_image';
    designMetadata: {
      aiImageId: string;
      aiImageUrl: string;
      aiImagePrompt: string;
      aiImageStyle: string;
      resourceType?: 'svg_2d' | 'ai_prompt_image' | 'ai_face_ref_image';
      referenceId?: string | null;
      parentImageId?: string | null;
      iteration?: number;
    };
  }) => Promise<void>;
}

const STYLE_PRESETS: Array<{
  id: AIImageStylePreset;
  name: string;
  badge: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'elegant_fashion_2d',
    name: 'Minh họa thời trang 2D thanh lịch',
    badge: 'Fashion Editorial 2D',
    description: 'Nét vẽ thanh mảnh, dáng người mềm mại tao nhã, chuẩn phong cách runway lookbook thời trang Áo dài.',
    icon: '✨',
  },
  {
    id: 'digital_painting_2d',
    name: 'Digital painting 2D mỹ thuật',
    badge: 'Artistic 2D Painting',
    description: 'Tranh vẽ kỹ thuật số 2D có chiều sâu, ánh sáng nghệ thuật dịu dàng, phảng phất chất tranh sơn dầu/sơn mài Việt Nam.',
    icon: '🎨',
  },
  {
    id: 'modern_watercolor_2d',
    name: 'Tranh màu nước hiện đại',
    badge: 'Modern Watercolor',
    description: 'Vệt loang màu nước mềm mại, lãng mạn, bay bổng, nét mực tinh tế trên nền giấy gân mỹ thuật.',
    icon: '🌸',
  },
  {
    id: 'flat_vector_2d',
    name: 'Flat fashion illustration',
    badge: 'Flat Vector 2D',
    description: 'Đồ họa vector 2D sắc nét, mảng màu phẳng hiện đại, đường nét tối giản thời thượng và dứt khoát.',
    icon: '📐',
  },
];

const PROMPT_SUGGESTIONS = [
  {
    label: 'Sen hồng phố cổ',
    prompt: 'Áo dài lụa xanh ngọc bích, hoa sen thêu tay ngực áo, quần lụa trắng, nón lá sen, phố cổ Hà Nội mùa thu',
  },
  {
    label: 'Gấm hoàng triều Huế',
    prompt: 'Áo dài đỏ gấm hoàng triều thêu rồng phượng vàng kim, cổ cao truyền thống 4cm, quần vàng hoàng yến, đại nội Huế nguy nga',
  },
  {
    label: 'Nữ sinh thanh thuần',
    prompt: 'Áo dài trắng thanh thuần nữ sinh, quần đen lụa bóng, tay raglan ôm nhẹ, cặp sách da và xe đạp hoa phượng sân trường',
  },
  {
    label: 'Cách tân hoa nhí',
    prompt: 'Áo dài cách tân hồng pastel hoa nhí, tà lửng trẻ trung, cổ tròn thanh thoát, quần lụa trắng kem, quán cafe hiện đại Sài Gòn',
  },
  {
    label: 'Lam di sản gấm mây',
    prompt: 'Áo dài lam di sản gấm vân mây cung đình, mấn đội đầu gấm thêu hoa, chuỗi vòng ngọc trai, cầu Tràng Tiền hoàng hôn lãng mạn',
  },
];

export const AIImageStudio: React.FC<AIImageStudioProps> = ({
  currentLook,
  onApplyConfigToStudio,
  onSaveImageToLookbook,
}) => {
  // Mode selection: 'prompt' (Mô tả văn bản) or 'face_ref' (Thử với ảnh của tôi)
  const [activeMode, setActiveMode] = useState<'prompt' | 'face_ref'>('face_ref');

  // Input states
  const [prompt, setPrompt] = useState(
    'Áo dài lụa xanh ngọc bích, hoa sen thêu tay ngực áo, quần lụa trắng, nón lá sen, phố cổ Hà Nội mùa thu'
  );
  const [selectedStyle, setSelectedStyle] = useState<AIImageStylePreset>('elegant_fashion_2d');
  const [useCurrentLookAsBase, setUseCurrentLookAsBase] = useState(false);

  // Face reference state
  const [faceReference, setFaceReference] = useState<FaceReferenceItem | null>(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [isUploadingFace, setIsUploadingFace] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversational Multi-turn Editing state
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [keepFaceInEdit, setKeepFaceInEdit] = useState(true);
  const [lineageJobs, setLineageJobs] = useState<AIImageJob[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Process / Gallery states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgressText, setGenerationProgressText] = useState('');
  const [currentJob, setCurrentJob] = useState<AIImageJob | null>(null);
  const [sessionJobs, setSessionJobs] = useState<AIImageJob[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  const [isSavingLookbook, setIsSavingLookbook] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Load past jobs in session
  useEffect(() => {
    loadSessionJobs();
  }, []);

  // Fetch lineage when currentJob changes
  useEffect(() => {
    if (currentJob?.id) {
      fetchAIImageLineage(currentJob.id)
        .then((res) => setLineageJobs(res.lineage))
        .catch(() => setLineageJobs([currentJob]));
    } else {
      setLineageJobs([]);
    }
  }, [currentJob?.id]);

  const loadSessionJobs = async () => {
    try {
      const res = await fetchAIImageJobs();
      setSessionJobs(res.jobs);
      if (res.jobs.length > 0 && !currentJob) {
        const latest = res.jobs.find((j) => j.status === 'completed') || res.jobs[0];
        setCurrentJob(latest);
      }
    } catch (err: any) {
      console.warn('Không thể tải lịch sử ảnh AI:', err.message);
    }
  };

  const handleFaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFaceFile(file);
  };

  const processFaceFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatusMessage({
        text: 'Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.',
        type: 'error',
      });
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setStatusMessage({
        text: 'Dung lượng ảnh vượt quá giới hạn 8MB. Vui lòng chọn ảnh nhỏ hơn.',
        type: 'error',
      });
      return;
    }

    setIsUploadingFace(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await uploadFaceReference(base64Data, file.name);
          setFaceReference(res.reference);
          setFacePreviewUrl(base64Data);
          setPrivacyConsentChecked(true);
          setStatusMessage({
            text: 'Đã tải ảnh chân dung thành công! Metadata EXIF đã được lọc sạch, tệp tự động hết hạn và xóa sau 24 giờ.',
            type: 'success',
          });
        } catch (err: any) {
          setStatusMessage({
            text: err.message || 'Lỗi tải ảnh chân dung lên máy chủ',
            type: 'error',
          });
        } finally {
          setIsUploadingFace(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingFace(false);
      setStatusMessage({
        text: `Lỗi đọc tệp ảnh: ${err.message}`,
        type: 'error',
      });
    }
  };

  const handleDeleteFace = async () => {
    if (!faceReference) return;
    try {
      await deleteFaceReference(faceReference.id);
      setFaceReference(null);
      setFacePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setStatusMessage({
        text: 'Đã xóa ảnh chân dung tham chiếu khỏi máy chủ và phiên làm việc.',
        type: 'info',
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi khi xóa ảnh tham chiếu: ${err.message}`,
        type: 'error',
      });
    }
  };

  const handleSyncFromCurrentLook = () => {
    const c = currentLook.config;
    const desc = `Áo dài lụa màu ${c.primaryColor.name}, quần lụa màu ${c.pantsColor.name}, cổ áo ${c.collarStyle}, tay áo ${c.sleeveStyle}, chất liệu ${c.fabric}${c.pattern ? `, họa tiết ${c.pattern}` : ''}${c.accessories?.length ? `, phụ kiện ${c.accessories.join(', ')}` : ''}. Dáng đứng toàn thân thanh lịch 2D.`;
    setPrompt(desc);
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isGenerating) return;

    if (activeMode === 'face_ref') {
      if (!faceReference) {
        setStatusMessage({
          text: 'Vui lòng tải lên ảnh chân dung của bạn trước khi tạo ảnh minh họa.',
          type: 'warning',
        });
        return;
      }
      if (!privacyConsentChecked) {
        setStatusMessage({
          text: 'Vui lòng đánh dấu xác nhận quyền sử dụng ảnh và đồng ý xử lý bảo mật trước khi tiếp tục.',
          type: 'warning',
        });
        return;
      }
    }

    setIsGenerating(true);
    setStatusMessage(null);
    setGenerationProgressText(
      activeMode === 'face_ref'
        ? 'Đang nạp ảnh tham chiếu khuôn mặt và trích xuất đường nét minh họa 2D...'
        : 'Đang phân tích mô tả tiếng Việt và cấu trúc áo dài...'
    );

    const timer1 = setTimeout(() => {
      setGenerationProgressText('Đang thiết lập quy chuẩn văn hóa Áo dài (2 tà xẻ eo cao, quần lụa, giữ nét mặt)...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setGenerationProgressText('Đang kết nối cổng 9router Gateway (ag/gemini-3.1-flash-image) kết xuất minh họa 2D toàn thân...');
    }, 3500);

    const timer3 = setTimeout(() => {
      setGenerationProgressText('Đang kiểm tra chữ ký nhị phân (magic bytes) và lưu trữ bảo mật...');
    }, 15000);

    try {
      const res = await requestAIImage({
        prompt: cleanPrompt,
        stylePreset: selectedStyle,
        referenceId: activeMode === 'face_ref' && faceReference ? faceReference.id : undefined,
        useCurrentLookAsBase,
        lookId: useCurrentLookAsBase ? currentLook.id : undefined,
        async: false,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (res.job) {
        setCurrentJob(res.job);
        setShowComparison(false);
        await loadSessionJobs();

        setStatusMessage({
          text: `Tạo ảnh minh họa Áo dài 2D thành công! (${activeMode === 'face_ref' ? 'Đã áp dụng khuôn mặt tham chiếu' : 'Từ mô tả văn bản'}, độ phân giải 1024x1024)`,
          type: 'success',
        });
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      let msg = err.message || 'Lỗi không xác định khi tạo ảnh';
      if (err instanceof ApiError && err.status === 429) {
        msg = 'Bạn đang có quá nhiều yêu cầu tạo ảnh đồng thời. Vui lòng đợi trong giây lát.';
      } else if (err instanceof ApiError && err.status === 502) {
        msg = `Cổng AI tạo ảnh báo lỗi: ${err.message}. Hệ thống không dùng ảnh giả mạo để đảm bảo tính minh bạch.`;
      }
      setStatusMessage({
        text: msg,
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgressText('');
    }
  };

  const handleConversationalEdit = async () => {
    const cleanEditPrompt = editPrompt.trim();
    if (!cleanEditPrompt || isEditing || !currentJob) return;

    setIsEditing(true);
    setStatusMessage(null);
    setGenerationProgressText('Đang thực hiện chỉnh sửa hội thoại đa lượt và bảo toàn nét mặt/chi tiết đã khóa...');

    try {
      const res = await editAIImage({
        parentImageId: currentJob.id,
        instruction: cleanEditPrompt,
        keepFaceReference: keepFaceInEdit,
        stylePreset: currentJob.stylePreset,
        lookId: currentLook.id,
        async: false,
      });

      if (res.job) {
        setCurrentJob(res.job);
        setEditPrompt('');
        setShowComparison(true);
        await loadSessionJobs();
        try {
          const l = await fetchAIImageLineage(res.job.id);
          setLineageJobs(l.lineage);
        } catch {}

        setStatusMessage({
          text: `Chỉnh sửa ảnh thành công! Đã tạo phiên bản v${res.job.iteration || 2} kế thừa từ bản trước.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi chỉnh sửa ảnh: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsEditing(false);
      setGenerationProgressText('');
    }
  };

  const handleApplyToStudio = () => {
    if (!currentJob?.parsedDetails) return;
    const p = currentJob.parsedDetails;

    const newConfig: GarmentConfig = {
      ...currentLook.config,
      primaryColor: p.primaryColor || currentLook.config.primaryColor,
      pantsColor: p.pantsColor || currentLook.config.pantsColor,
      collarStyle: p.collarStyle || currentLook.config.collarStyle,
      sleeveStyle: p.sleeveStyle || currentLook.config.sleeveStyle,
      fabric: p.fabric || currentLook.config.fabric,
      pattern: p.pattern || currentLook.config.pattern,
      accessories: p.accessories || currentLook.config.accessories,
    };

    const aoName = p.primaryColor?.name || currentLook.config.primaryColor.name;
    const quanName = p.pantsColor?.name || currentLook.config.pantsColor.name;
    const title = `Áo dài ${aoName} & Quần ${quanName} (từ AI)`;
    const explanation = `Áp dụng từ ảnh AI: ${currentJob.prompt}. Cổ áo ${newConfig.collarStyle}, tay ${newConfig.sleeveStyle}, chất liệu ${newConfig.fabric}.`;

    onApplyConfigToStudio(newConfig, title, explanation);
    setStatusMessage({
      text: 'Đã áp dụng thông số màu sắc và chi tiết từ ảnh AI vào Phòng phối đồ (Outfit Room)!',
      type: 'success',
    });
  };

  const handleSaveToLookbook = async () => {
    if (!currentJob || isSavingLookbook) return;
    setIsSavingLookbook(true);
    setStatusMessage(null);

    try {
      const p = currentJob.parsedDetails;
      const configToSave: GarmentConfig = p
        ? {
            ...currentLook.config,
            primaryColor: p.primaryColor || currentLook.config.primaryColor,
            pantsColor: p.pantsColor || currentLook.config.pantsColor,
            collarStyle: p.collarStyle || currentLook.config.collarStyle,
            sleeveStyle: p.sleeveStyle || currentLook.config.sleeveStyle,
            fabric: p.fabric || currentLook.config.fabric,
            pattern: p.pattern || currentLook.config.pattern,
            accessories: p.accessories || currentLook.config.accessories,
          }
        : currentLook.config;

      const title = currentJob.referenceId
        ? `Thử áo dài với khuôn mặt (v${currentJob.iteration || 1})`
        : `Minh họa AI: Áo dài ${p?.primaryColor?.name || 'Việt Nam'}`;
      const explanation = currentJob.prompt;
      const rType = currentJob.referenceId ? 'ai_face_ref_image' : 'ai_prompt_image';

      await onSaveImageToLookbook({
        title,
        config: configToSave,
        explanation,
        resourceType: rType,
        designMetadata: {
          aiImageId: currentJob.id,
          aiImageUrl: currentJob.imageUrl || `/api/ai/images/${currentJob.id}/file`,
          aiImagePrompt: currentJob.prompt,
          aiImageStyle: currentJob.stylePreset,
          resourceType: rType,
          referenceId: currentJob.referenceId,
          parentImageId: currentJob.parentImageId,
          iteration: currentJob.iteration || 1,
        },
      });

      setStatusMessage({
        text: 'Đã lưu ảnh minh họa AI vào Lookbook thành công!',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        text: `Lỗi lưu vào Lookbook: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSavingLookbook(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (deletingJobId) return;
    setDeletingJobId(id);
    try {
      await deleteAIImage(id);
      setSessionJobs((prev) => prev.filter((j) => j.id !== id));
      if (currentJob?.id === id) {
        const remaining = sessionJobs.filter((j) => j.id !== id);
        setCurrentJob(remaining.length > 0 ? remaining[0] : null);
      }
      setStatusMessage({
        text: 'Đã xóa ảnh minh họa khỏi danh sách.',
        type: 'info',
      });
    } catch (err: any) {
      alert(`Lỗi khi xóa ảnh: ${err.message}`);
    } finally {
      setDeletingJobId(null);
    }
  };

  const parentJob = currentJob?.parentImageId
    ? sessionJobs.find((j) => j.id === currentJob.parentImageId) ||
      lineageJobs.find((j) => j.id === currentJob.parentImageId) ||
      null
    : null;

  return (
    <div className="ai-image-studio" style={{ maxWidth: '1240px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Studio Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles className="text-accent-red" size={24} />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--text-primary)', margin: 0 }}>
              Xưởng Vẽ Áo Dài AI 2D
            </h2>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              background: '#DCFCE7',
              color: '#166534',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              border: '1px solid #BBF7D0',
            }}
          >
            ⚡ Trực tuyến: 9router · ag/gemini-3.1-flash-image
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              background: '#EDE9FE',
              color: '#5B21B6',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              border: '1px solid #DDD6FE',
            }}
          >
            Minh họa 2D thuần túy
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
          Nhập mô tả bằng tiếng Việt hoặc tải ảnh chân dung khuôn mặt để tạo tranh minh họa 2D người mẫu mặc Áo dài truyền thống với chuẩn mực văn hóa đích thực.
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveMode('face_ref')}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '0.8rem 1.2rem',
            borderRadius: 'var(--radius-lg)',
            border: activeMode === 'face_ref' ? '2px solid var(--accent-red)' : '1px solid var(--border-medium)',
            background: activeMode === 'face_ref' ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
            color: activeMode === 'face_ref' ? 'var(--accent-red)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
            boxShadow: activeMode === 'face_ref' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <Camera size={18} />
          <span>Thử áo dài với ảnh của tôi (Face Reference)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('prompt')}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '0.8rem 1.2rem',
            borderRadius: 'var(--radius-lg)',
            border: activeMode === 'prompt' ? '2px solid var(--accent-red)' : '1px solid var(--border-medium)',
            background: activeMode === 'prompt' ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
            color: activeMode === 'prompt' ? 'var(--accent-red)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
            boxShadow: activeMode === 'prompt' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <Sparkles size={18} />
          <span>Vẽ theo mô tả văn bản (Text to Image)</span>
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            background:
              statusMessage.type === 'error'
                ? '#FEE2E2'
                : statusMessage.type === 'warning'
                ? '#FEF3C7'
                : statusMessage.type === 'info'
                ? '#E0F2FE'
                : 'var(--accent-red-soft)',
            color:
              statusMessage.type === 'error'
                ? '#991B1B'
                : statusMessage.type === 'warning'
                ? '#92400E'
                : statusMessage.type === 'info'
                ? '#075985'
                : 'var(--accent-red)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: `1px solid ${
              statusMessage.type === 'error'
                ? '#FCA5A5'
                : statusMessage.type === 'warning'
                ? '#FCD34D'
                : statusMessage.type === 'info'
                ? '#BAE6FD'
                : '#FECDD3'
            }`,
          }}
        >
          {statusMessage.type === 'success' && <CheckCircle2 size={18} />}
          {statusMessage.type === 'error' && <AlertCircle size={18} />}
          {statusMessage.type === 'info' && <Info size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Control Panel (Left) & Image Preview & Analysis (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '2rem' }}>
        {/* Left Column: Form Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Face Reference Upload Card (Chỉ hiện khi ở chế độ face_ref) */}
          {activeMode === 'face_ref' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Camera size={18} className="text-accent-red" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Ảnh chân dung khuôn mặt
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: '#FEF3C7',
                    color: '#92400E',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  Tối đa 8MB
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFaceFileChange}
                style={{ display: 'none' }}
              />

              {faceReference && facePreviewUrl ? (
                /* Preview State */
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '2px solid var(--accent-red)',
                        background: '#18181B',
                      }}
                    >
                      <img
                        src={facePreviewUrl}
                        alt="Khuôn mặt tham chiếu"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {faceReference.filename || 'Ảnh chân dung tham chiếu'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        {Math.round(faceReference.fileSize / 1024)} KB · {faceReference.mimeType}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#166534' }}>
                        <ShieldCheck size={14} />
                        <span>Đã lọc sạch EXIF · Tự động xóa sau 24h</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingFace}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: isUploadingFace ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>{isUploadingFace ? 'Đang tải...' : 'Thay ảnh khác'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteFace}
                      style={{
                        padding: '0.45rem 0.75rem',
                        background: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#991B1B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa ảnh</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload Dropzone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFaceFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--accent-red)' : 'var(--border-medium)'}`,
                    background: isDragging ? 'var(--accent-red-soft)' : 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.5rem 1rem',
                    textAlign: 'center',
                    cursor: isUploadingFace ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-light)',
                        color: 'var(--accent-red)',
                      }}
                    >
                      {isUploadingFace ? <RefreshCw size={22} className="animate-spin" /> : <Upload size={22} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {isUploadingFace ? 'Đang tải và lọc sạch EXIF...' : 'Kéo thả ảnh chân dung hoặc bấm để chọn tệp'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Hỗ trợ JPG, PNG, WebP (Tối đa 8MB)
                  </div>
                </div>
              )}

              {/* Photo tips */}
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                <strong>💡 Gợi ý ảnh đẹp:</strong> Chụp rõ khuôn mặt, góc thẳng hoặc nghiêng nhẹ, đủ ánh sáng tự nhiên. Tránh khẩu trang, kính râm to, và chỉ nên có 1 người. Không yêu cầu ảnh toàn thân.
              </div>

              {/* Consent & Privacy Notice */}
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.76rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={privacyConsentChecked}
                    onChange={(e) => setPrivacyConsentChecked(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: 'var(--accent-red)' }}
                  />
                  <span>
                    Tôi xác nhận có quyền sử dụng bức ảnh này và đồng ý gửi tới nhà cung cấp AI bên ngoài để xử lý minh họa 2D. Ảnh sẽ được tự động xóa sau 24 giờ.
                  </span>
                </label>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, paddingLeft: '1.4rem' }}>
                  ℹ️ Thông báo: Đây là hình ảnh do AI minh họa tạo ra, không phải phép thử đồ đảm bảo chính xác vóc dáng hoặc tỷ lệ cơ thể thực tế.
                </div>
              </div>
            </div>
          )}

          {/* 1. Prompt Input */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {activeMode === 'face_ref' ? '2. Mô tả bộ áo dài muốn mặc' : '1. Mô tả áo dài bằng tiếng Việt'}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSyncFromCurrentLook}
                  title="Điền tự động mô tả từ bộ áo dài hiện tại trong Phòng phối đồ"
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--accent-red)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                  }}
                >
                  <Layers size={12} />
                  <span>Lấy từ bản phối 2D</span>
                </button>
                <span style={{ fontSize: '0.75rem', color: prompt.length > 900 ? '#DC2626' : 'var(--text-muted)' }}>
                  {prompt.length}/1000 ký tự
                </span>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Ví dụ: Áo dài lụa xanh ngọc bích, hoa sen thêu tay ngực áo, quần lụa trắng, nón lá sen, phố cổ Hà Nội mùa thu..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
                boxSizing: 'border-box',
                background: 'var(--bg-subtle)',
                fontFamily: 'inherit',
              }}
            />

            {/* Prompt Suggestion Chips */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                💡 Gợi ý mô tả mẫu:
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {PROMPT_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(item.prompt)}
                    style={{
                      fontSize: '0.75rem',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      padding: '0.3rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Use Current Look as Base option */}
            <div
              style={{
                padding: '0.75rem',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                border: '1px solid var(--border-light)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={useCurrentLookAsBase}
                  onChange={(e) => setUseCurrentLookAsBase(e.target.checked)}
                  style={{ accentColor: 'var(--accent-red)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Lấy cảm hứng từ bộ phối hiện tại (Phòng phối)</span>
              </label>
              {useCurrentLookAsBase && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1.5rem' }}>
                  Hệ thống sẽ kết hợp màu áo (<strong>{currentLook.config.primaryColor.name}</strong>), màu quần (<strong>{currentLook.config.pantsColor.name}</strong>) và các chi tiết từ Outfit Room vào mô tả tạo ảnh.
                </div>
              )}
            </div>

            {/* 2. Select 2D Style Preset */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
                2. Chọn phong cách minh họa 2D:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                {STYLE_PRESETS.map((preset) => {
                  const isSelected = selectedStyle === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedStyle(preset.id)}
                      style={{
                        padding: '0.7rem',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--accent-red)' : 'var(--border-light)'}`,
                        background: isSelected ? 'var(--accent-red-soft)' : 'var(--bg-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '1rem' }}>{preset.icon}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                          {preset.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                        {preset.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || (activeMode === 'face_ref' && (!faceReference || !privacyConsentChecked))}
              style={{
                width: '100%',
                padding: '0.85rem',
                background:
                  isGenerating || !prompt.trim() || (activeMode === 'face_ref' && (!faceReference || !privacyConsentChecked))
                    ? 'var(--text-muted)'
                    : 'var(--accent-red)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor:
                  isGenerating || !prompt.trim() || (activeMode === 'face_ref' && (!faceReference || !privacyConsentChecked))
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow:
                  isGenerating || !prompt.trim() || (activeMode === 'face_ref' && (!faceReference || !privacyConsentChecked))
                    ? 'none'
                    : '0 2px 8px rgba(185, 28, 28, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Đang tạo ảnh AI...</span>
                </>
              ) : activeMode === 'face_ref' ? (
                <>
                  <Camera size={18} />
                  <span>Thử Áo Dài Với Khuôn Mặt Bằng AI</span>
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  <span>Vẽ Áo Dài 2D bằng AI</span>
                </>
              )}
            </button>

            {activeMode === 'face_ref' && (!faceReference || !privacyConsentChecked) && (
              <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '0.5rem', textAlign: 'center' }}>
                {!faceReference
                  ? '⚠️ Vui lòng tải ảnh chân dung lên để thử áo dài'
                  : '⚠️ Vui lòng đánh dấu đồng ý điều khoản bảo mật'}
              </div>
            )}
          </div>

          {/* Cultural Guardrail Notice */}
          <div
            style={{
              background: '#F0FDF4',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid #BBF7D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <ShieldAlert size={18} className="text-emerald-700" />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534', margin: 0 }}>
                Quy chuẩn văn hóa Áo dài Việt Nam
              </h4>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#14532D', lineHeight: 1.5, margin: 0 }}>
              Bộ tạo prompt tự động áp đặt ràng buộc giải phẫu chuẩn xác: Thân áo ôm sát tôn dáng, <strong>hai tà trước và sau xẻ từ eo cao</strong>, mặc cùng <strong>quần lụa dài kín đáo</strong> bên dưới. Nghiêm cấm tạo hình váy liền xẻ đùi (Qipao/Sườn xám) hay trang phục Kimono/Hanbok.
            </p>
          </div>
        </div>

        {/* Right Column: High-Res 2D Output & Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main Image Showcase */}
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {isGenerating ? (
              <div
                style={{
                  width: '100%',
                  minHeight: '380px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--accent-red)',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                }}
              >
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      border: '4px solid var(--border-light)',
                      borderTopColor: 'var(--accent-red)',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <Wand2 size={24} className="text-accent-red" />
                  </div>
                </div>

                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  AI đang vẽ tranh Áo dài 2D...
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.5, marginBottom: '1rem' }}>
                  {generationProgressText}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ước tính khoảng 10 - 25 giây qua 9router live gateway
                </div>
              </div>
            ) : currentJob && currentJob.status === 'completed' && currentJob.imageUrl ? (
              <div style={{ width: '100%' }}>
                {/* Result Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        background: '#DCFCE7',
                        color: '#166534',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                      }}
                    >
                      ✓ Đã kết xuất 1024x1024 2D
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {currentJob.durationMs ? `${(currentJob.durationMs / 1000).toFixed(1)}s` : ''} · {currentJob.fileSize ? `${Math.round(currentJob.fileSize / 1024)} KB` : ''}
                    </span>
                  </div>

                  <a
                    href={currentJob.downloadUrl || `/api/ai/images/${currentJob.id}/file?download=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mở toàn màn hình trong tab mới"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.78rem',
                      color: 'var(--accent-blue)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Xem ảnh gốc</span>
                  </a>
                </div>

                {/* The Rendered Image (Hoặc So Sánh Hai Phiên Bản) */}
                {showComparison && parentJob && parentJob.imageUrl ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Bản trước (Parent) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            background: 'var(--bg-subtle)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Bản trước (v{parentJob.iteration || 1})
                        </span>
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          background: '#18181B',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          maxHeight: '460px',
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        <img
                          src={parentJob.imageUrl}
                          alt="Bản trước"
                          style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '460px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </div>
                    </div>

                    {/* Bản mới hiện tại (Child) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--accent-red)',
                            background: 'var(--accent-red-soft)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Bản chỉnh sửa mới (v{currentJob.iteration || 2})
                        </span>
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          background: '#18181B',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          maxHeight: '460px',
                          border: '2px solid var(--accent-red)',
                        }}
                      >
                        <img
                          src={currentJob.imageUrl}
                          alt={currentJob.prompt}
                          style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '460px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      background: '#18181B',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      maxHeight: '520px',
                    }}
                  >
                    <img
                      src={currentJob.imageUrl}
                      alt={currentJob.prompt}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '520px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>
                )}

                {/* Action Buttons & Resource Badges */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleApplyToStudio}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.7rem',
                      background: 'var(--accent-red)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Layers size={16} />
                    <span>Áp dụng vào Outfit Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToLookbook}
                    disabled={isSavingLookbook}
                    style={{
                      padding: '0.7rem 1rem',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: isSavingLookbook ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <BookmarkPlus size={16} />
                    <span>{isSavingLookbook ? 'Đang lưu...' : 'Lưu Lookbook'}</span>
                  </button>

                  {parentJob && parentJob.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setShowComparison(!showComparison)}
                      style={{
                        padding: '0.7rem 1rem',
                        background: showComparison ? 'var(--accent-red-soft)' : 'var(--bg-subtle)',
                        border: `1px solid ${showComparison ? 'var(--accent-red)' : 'var(--border-medium)'}`,
                        color: showComparison ? 'var(--accent-red)' : 'var(--text-primary)',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer',
                      }}
                    >
                      <GitCompare size={16} />
                      <span>{showComparison ? 'Xem ảnh đơn' : 'So sánh trước/sau'}</span>
                    </button>
                  )}

                  <a
                    href={currentJob.downloadUrl || `/api/ai/images/${currentJob.id}/file?download=1`}
                    download={`aodai_2d_${currentJob.id}.jpg`}
                    style={{
                      padding: '0.7rem 1rem',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--accent-blue)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={16} />
                    <span>Tải ảnh</span>
                  </a>
                </div>

                {/* Entity Tags & Deconstruction Section */}
                {currentJob.parsedDetails && (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '1rem',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 0.6rem 0', color: 'var(--text-primary)' }}>
                      🔍 Thực thể thời trang đã bóc tách:
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem' }}>
                      {/* Màu áo */}
                      {currentJob.parsedDetails.primaryColor && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: 'var(--bg-surface)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: currentJob.parsedDetails.primaryColor.hex,
                              display: 'inline-block',
                              border: '1px solid #ccc',
                            }}
                          />
                          Áo: <strong>{currentJob.parsedDetails.primaryColor.name}</strong>
                        </span>
                      )}

                      {/* Màu quần */}
                      {currentJob.parsedDetails.pantsColor && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: 'var(--bg-surface)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: currentJob.parsedDetails.pantsColor.hex,
                              display: 'inline-block',
                              border: '1px solid #ccc',
                            }}
                          />
                          Quần: <strong>{currentJob.parsedDetails.pantsColor.name}</strong>
                        </span>
                      )}

                      {/* Cổ áo */}
                      {currentJob.parsedDetails.collarStyle && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Cổ: <strong>{currentJob.parsedDetails.collarStyle}</strong>
                        </span>
                      )}

                      {/* Tay áo */}
                      {currentJob.parsedDetails.sleeveStyle && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Tay: <strong>{currentJob.parsedDetails.sleeveStyle}</strong>
                        </span>
                      )}

                      {/* Chất liệu */}
                      {currentJob.parsedDetails.fabric && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Vải: <strong>{currentJob.parsedDetails.fabric}</strong>
                        </span>
                      )}

                      {/* Họa tiết */}
                      {currentJob.parsedDetails.pattern && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Họa tiết: <strong>{currentJob.parsedDetails.pattern}</strong>
                        </span>
                      )}

                      {/* Bối cảnh */}
                      {currentJob.parsedDetails.backgroundContext && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Bối cảnh: <strong>{currentJob.parsedDetails.backgroundContext}</strong>
                        </span>
                      )}

                      {/* Phụ kiện */}
                      {Boolean(currentJob.parsedDetails.accessories && currentJob.parsedDetails.accessories.length > 0) && (
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          Phụ kiện: <strong>{currentJob.parsedDetails.accessories!.join(', ')}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Resource Type & Iteration Badge */}
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: currentJob.referenceId ? '#EDE9FE' : '#E0F2FE',
                      color: currentJob.referenceId ? '#6B21A8' : '#0369A1',
                      border: `1px solid ${currentJob.referenceId ? '#DDD6FE' : '#BAE6FD'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    {currentJob.referenceId ? (
                      <>
                        <User size={13} />
                        <span>Tài nguyên: Thử Áo Dài Khuôn Mặt (ai_face_ref_image)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Tài nguyên: Minh Họa AI Từ Mô Tả (ai_prompt_image)</span>
                      </>
                    )}
                  </span>
                  {currentJob.iteration && currentJob.iteration > 1 && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      Lượt chỉnh sửa #{currentJob.iteration}
                    </span>
                  )}
                </div>

                {/* Lineage History Breadcrumbs */}
                {lineageJobs.length > 1 && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Phả hệ phiên bản chỉnh sửa ({lineageJobs.length} phiên bản):
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {lineageJobs.map((j, idx) => {
                        const isCurrent = j.id === currentJob.id;
                        return (
                          <React.Fragment key={j.id}>
                            {idx > 0 && <ArrowRight size={12} className="text-text-muted" />}
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentJob(j);
                                setShowComparison(false);
                              }}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: isCurrent ? 700 : 500,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: isCurrent ? '1px solid var(--accent-red)' : '1px solid var(--border-light)',
                                background: isCurrent ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
                                color: isCurrent ? 'var(--accent-red)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              v{j.iteration || idx + 1}
                              {isCurrent ? ' (Đang xem)' : ''}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Conversational Multi-turn Edit Card */}
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1.25rem',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <MessageSquare size={18} className="text-accent-red" />
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Chỉnh sửa ảnh bằng câu lệnh tự nhiên (Multi-turn Editing)
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
                    Tinh chỉnh các chi tiết trang phục, màu sắc hoặc bối cảnh mà không làm mất khuôn mặt và các thuộc tính đã cố định từ bản trước.
                  </p>

                  {/* Suggestion edit chips */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {[
                      'Giữ khuôn mặt, đổi áo dài sang màu đỏ ruby',
                      'Đổi áo dài sang màu xanh ngọc bích',
                      'Thêm hoa sen thêu tay nhỏ ở tà phải',
                      'Đổi quần lụa sang màu đen truyền thống',
                      'Đổi nền thành sân trường hoa phượng vĩ',
                      'Đổi nền thành phố cổ Hà Nội mùa thu',
                      'Tà áo dài thướt tha hơn, dài chạm đất',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditPrompt(chip)}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: '1px solid var(--border-light)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={2}
                      placeholder="Ví dụ: Giữ nguyên khuôn mặt và dáng người, nhưng đổi áo sang màu đỏ thêu hoa sen..."
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.85rem',
                        lineHeight: 1.45,
                        background: 'var(--bg-surface)',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={keepFaceInEdit}
                        onChange={(e) => setKeepFaceInEdit(e.target.checked)}
                        style={{ accentColor: 'var(--accent-red)' }}
                      />
                      <span>Bảo toàn đặc điểm khuôn mặt tham chiếu</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleConversationalEdit}
                      disabled={isEditing || !editPrompt.trim()}
                      style={{
                        padding: '0.6rem 1.25rem',
                        background: isEditing || !editPrompt.trim() ? 'var(--text-muted)' : 'var(--accent-red)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: isEditing || !editPrompt.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: isEditing || !editPrompt.trim() ? 'none' : '0 2px 6px rgba(185, 28, 28, 0.25)',
                      }}
                    >
                      {isEditing ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Đang tinh chỉnh...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} />
                          <span>Tạo phiên bản mới (v{(currentJob.iteration || 1) + 1})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  minHeight: '360px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-medium)',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                }}
              >
                <ImageIcon size={48} className="text-text-muted" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Chưa có ảnh minh họa nào được tạo
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
                  Nhập mô tả ở khung bên trái hoặc chọn gợi ý mẫu rồi nhấn nút <strong>"Vẽ Áo Dài 2D bằng AI"</strong> để trải nghiệm kết xuất ảnh thực tế.
                </p>
              </div>
            )}
          </div>

          {/* Session Gallery / Lịch sử ảnh đã tạo */}
          {sessionJobs.length > 0 && (
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  🖼️ Thư viện ảnh đã tạo trong phiên ({sessionJobs.length})
                </h4>
                <button
                  type="button"
                  onClick={loadSessionJobs}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Làm mới</span>
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '0.6rem',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {sessionJobs.map((job) => {
                  const isCurrent = currentJob?.id === job.id;
                  const isDeleting = deletingJobId === job.id;
                  return (
                    <div
                      key={job.id}
                      style={{
                        position: 'relative',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: `2px solid ${isCurrent ? 'var(--accent-red)' : 'var(--border-light)'}`,
                        cursor: 'pointer',
                        aspectRatio: '3/4',
                        background: '#27272A',
                      }}
                      onClick={() => setCurrentJob(job)}
                    >
                      {job.imageUrl ? (
                        <img
                          src={job.imageUrl}
                          alt={job.prompt}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            color: '#9CA3AF',
                          }}
                        >
                          {job.status === 'processing' ? 'Đang tạo...' : 'Lỗi'}
                        </div>
                      )}

                      {/* Delete icon button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        disabled={isDeleting}
                        title="Xóa ảnh này"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#F87171',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
