import { nanoid } from 'nanoid';
import type { Action, PPTElement, Slide, SlideTheme } from '@openmaic/dsl';
import type { SceneOutline } from './outline-types.js';
import type {
  CompleteScene,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  GeneratedQuizContent,
  GeneratedSlideContent,
} from './scene-types.js';

export interface BuildCompleteSceneOptions {
  /**
   * Stable identity supplied by retrying/upserting consumers. Reusing it turns
   * a replay into the same logical scene instead of appending a duplicate.
   * The default remains a random `nanoid()` for drop-in compatibility.
   */
  sceneId?: string;
  /** A course-wide visual theme applied to every slide scene. */
  slideStyle?: 'consistent-light' | 'ai';
}

const CONSISTENT_LIGHT_COLORS = ['#6D28D9', '#0891B2', '#334155', '#A78BFA'];

function consistentLightElements(elements: PPTElement[]): PPTElement[] {
  return elements.map((element) => {
    if (element.type === 'text') {
      const content = element.content.replace(
        /<(p|span|strong|b|em|i|u|h[1-6])\b([^>]*)>/gi,
        (_tag, name: string, attributes: string) => {
          const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
          const previous = styleMatch?.[2] ?? '';
          const style = previous
            .replace(/(?:^|;)\s*(?:color|font-family)\s*:[^;]*/gi, '')
            .replace(/^\s*;|;\s*$/g, '');
          const nextStyle = [style, 'color:#0F172A', 'font-family:Inter,Arial,sans-serif']
            .filter(Boolean)
            .join(';');
          const rest = styleMatch
            ? attributes.replace(styleMatch[0], '')
            : attributes;
          return `<${name}${rest} style="${nextStyle}">`;
        },
      );
      return {
        ...element,
        content,
        defaultFontName: 'Inter',
        defaultColor: '#0F172A',
      };
    }
    if (element.type === 'shape' && /^#(?:0[0-9a-f]{5}|1[0-9a-f]{5})$/i.test(element.fill)) {
      return { ...element, fill: '#E2E8F0' };
    }
    if (element.type === 'chart') {
      return { ...element, themeColors: [...CONSISTENT_LIGHT_COLORS] };
    }
    return element;
  });
}

/** Build a complete, store-independent scene from generated primitives. */
export function buildCompleteScene(
  outline: SceneOutline,
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  actions: Action[],
  stageId: string,
  options: BuildCompleteSceneOptions = {},
): CompleteScene | null {
  const sceneId = options.sceneId ?? nanoid();
  const timestamps = { createdAt: Date.now(), updatedAt: Date.now() };

  if (outline.type === 'slide' && 'elements' in content) {
    const consistentLight = options.slideStyle === 'consistent-light';
    const defaultTheme: SlideTheme = {
      backgroundColor: consistentLight ? '#F8FAFC' : '#ffffff',
      themeColors: consistentLight
        ? [...CONSISTENT_LIGHT_COLORS]
        : ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
      fontColor: consistentLight ? '#0F172A' : '#333333',
      fontName: consistentLight ? 'Inter' : 'Microsoft YaHei',
      outline: { color: '#d14424', width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
    };
    const canvas: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: consistentLight ? consistentLightElements(content.elements) : content.elements,
      background: consistentLight ? { type: 'solid', color: '#F8FAFC' } : content.background,
    };
    return {
      id: sceneId,
      outlineId: outline.id,
      stageId,
      type: 'slide',
      title: outline.title,
      order: outline.order,
      content: { type: 'slide', canvas },
      actions,
      ...timestamps,
    };
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    return {
      id: sceneId,
      outlineId: outline.id,
      stageId,
      type: 'quiz',
      title: outline.title,
      order: outline.order,
      content: { type: 'quiz', questions: content.questions },
      actions,
      ...timestamps,
    };
  }

  if (outline.type === 'interactive' && 'html' in content) {
    return {
      id: sceneId,
      outlineId: outline.id,
      stageId,
      type: 'interactive',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'interactive',
        url: '',
        html: content.html,
        widgetType: content.widgetType,
        widgetConfig: content.widgetConfig,
      },
      actions,
      ...timestamps,
    };
  }

  if (outline.type === 'pbl' && 'projectV2' in content) {
    return {
      id: sceneId,
      outlineId: outline.id,
      stageId,
      type: 'pbl',
      title: outline.title,
      order: outline.order,
      content: { type: 'pbl', projectV2: content.projectV2 },
      actions,
      ...timestamps,
    };
  }

  return null;
}
