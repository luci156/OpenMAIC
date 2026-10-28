import { nanoid } from 'nanoid';
import type { Action, PPTElement, PPTShapeElement, Slide, SlideTheme } from '@openmaic/dsl';
import type { SceneOutline } from './outline-types.js';
import type {
  CompleteScene,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  GeneratedQuizContent,
  GeneratedSlideContent,
} from './scene-types.js';
import { getSlideDesignSkill, type SlideStyle } from './slide-design-skills.js';

const SLIDE_FONT = 'Times New Roman';

function plainSlideText(content: string): string {
  return content
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function isCompactWrappedLabel(
  element: Pick<Extract<PPTElement, { type: 'text' }>, 'width' | 'height'>,
  content: string,
): boolean {
  const text = plainSlideText(content);
  const words = text.split(/\s+/u).filter(Boolean);
  if (
    !text ||
    text.length > 84 ||
    words.length > 12 ||
    element.height < 44 ||
    element.height > 150
  ) {
    return false;
  }

  const fontSizes = [...content.matchAll(/font-size\s*:\s*([\d.]+)px/gi)].map((match) =>
    Number(match[1]),
  );
  const fontSize = Math.max(18, ...fontSizes.filter(Number.isFinite));
  const availableWidth = Math.max(1, element.width - 20);
  const lineCapacity = Math.max(1, Math.floor(availableWidth / (fontSize * 0.53)));
  const paragraphCount = content.match(/<p\b/gi)?.length ?? 0;
  const hasExplicitBreak = /<br\b/i.test(content) || paragraphCount > 1;
  const estimatedLines = text
    .split(/\n+/u)
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / lineCapacity)), 0);

  return hasExplicitBreak || estimatedLines > 1;
}

function centerSlideLabel(content: string): string {
  const blockTags = /<(p|div|h[1-6])\b([^>]*)>/gi;
  if (!blockTags.test(content)) return `<p style="text-align:center">${content}</p>`;
  blockTags.lastIndex = 0;
  return content.replace(blockTags, (_tag, name: string, attributes: string) => {
    const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
    const previous = styleMatch?.[2] ?? '';
    const style = previous
      .replace(/(?:^|;)\s*text-align\s*:[^;]*/gi, '')
      .replace(/^\s*;|;\s*$/g, '');
    const nextStyle = [style, 'text-align:center'].filter(Boolean).join(';');
    const rest = styleMatch ? attributes.replace(styleMatch[0], '') : attributes;
    return `<${name}${rest} style="${nextStyle}">`;
  });
}

export interface BuildCompleteSceneOptions {
  /**
   * Stable identity supplied by retrying/upserting consumers. Reusing it turns
   * a replay into the same logical scene instead of appending a duplicate.
   * The default remains a random `nanoid()` for drop-in compatibility.
   */
  sceneId?: string;
  /** A course-wide visual theme applied to every slide scene. */
  slideStyle?: SlideStyle;
}

function applySlideDesignSkill(elements: PPTElement[], slideStyle: SlideStyle): PPTElement[] {
  const skill = getSlideDesignSkill(slideStyle);

  return elements.map((element) => {
    if (element.type === 'text') {
      const centerWrappedLabel = isCompactWrappedLabel(element, element.content);
      const sourceContent = centerWrappedLabel
        ? centerSlideLabel(element.content)
        : element.content;
      const content = sourceContent.replace(
        /<(p|span|strong|b|em|i|u|h[1-6])\b([^>]*)>/gi,
        (_tag, name: string, attributes: string) => {
          const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
          const previous = styleMatch?.[2] ?? '';
          const style = previous
            .replace(/(?:^|;)\s*font-family\s*:[^;]*/gi, '')
            .replace(/^\s*;|;\s*$/g, '');
          const font = `font-family:'${SLIDE_FONT}',serif`;
          const nextStyle = [style, font].filter(Boolean).join(';');
          const rest = styleMatch ? attributes.replace(styleMatch[0], '') : attributes;
          return `<${name}${rest} style="${nextStyle}">`;
        },
      );
      return {
        ...element,
        content,
        ...(centerWrappedLabel ? { vAlign: 'middle' as const } : {}),
        defaultFontName: SLIDE_FONT,
        ...(skill ? { defaultColor: skill.text } : {}),
      };
    }
    if (element.type === 'shape' && element.text) {
      const centerWrappedLabel = isCompactWrappedLabel(element, element.text.content);
      const sourceContent = centerWrappedLabel
        ? centerSlideLabel(element.text.content)
        : element.text.content;
      const content = sourceContent.replace(
        /<(p|span|strong|b|em|i|u|h[1-6])\b([^>]*)>/gi,
        (_tag, name: string, attributes: string) => {
          const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
          const previous = styleMatch?.[2] ?? '';
          const style = previous
            .replace(/(?:^|;)\s*font-family\s*:[^;]*/gi, '')
            .replace(/^\s*;|;\s*$/g, '');
          const font = `font-family:'${SLIDE_FONT}',serif`;
          const nextStyle = [style, font].filter(Boolean).join(';');
          const rest = styleMatch ? attributes.replace(styleMatch[0], '') : attributes;
          return `<${name}${rest} style="${nextStyle}">`;
        },
      );
      const text = {
        ...element.text,
        content,
        ...(skill ? { defaultColor: skill.text } : {}),
      };
      return { ...element, text } satisfies PPTShapeElement;
    }
    if (skill && element.type === 'chart') {
      return { ...element, themeColors: [...skill.colors] };
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
    const skill = getSlideDesignSkill(options.slideStyle);
    const defaultTheme: SlideTheme = {
      backgroundColor: skill?.background ?? '#ffffff',
      themeColors: skill
        ? [...skill.colors]
        : ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
      fontColor: skill?.text ?? '#333333',
      fontName: 'Times New Roman',
      outline: { color: skill?.colors[0] ?? '#167E78', width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 8, color: '#A7A7A7' },
    };
    const canvas: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: applySlideDesignSkill(content.elements, options.slideStyle ?? 'consistent-light'),
      background: skill ? { type: 'solid', color: skill.background } : content.background,
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
