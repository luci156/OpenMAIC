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
import { getSlideDesignSkill, type SlideStyle } from './slide-design-skills.js';

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
  if (!skill) return elements;

  return elements.map((element) => {
    if (element.type === 'text') {
      const content = element.content.replace(
        /<(p|span|strong|b|em|i|u|h[1-6])\b([^>]*)>/gi,
        (_tag, name: string, attributes: string) => {
          const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
          const previous = styleMatch?.[2] ?? '';
          const style = previous
            .replace(/(?:^|;)\s*font-family\s*:[^;]*/gi, '')
            .replace(/^\s*;|;\s*$/g, '');
          const fontName = /^h[1-3]$/i.test(name) ? skill.titleFont : skill.bodyFont;
          const font =
            fontName === 'Georgia'
              ? "font-family:Georgia,'Times New Roman',serif"
              : 'font-family:Inter,Arial,sans-serif';
          const nextStyle = [style, font].filter(Boolean).join(';');
          const rest = styleMatch ? attributes.replace(styleMatch[0], '') : attributes;
          return `<${name}${rest} style="${nextStyle}">`;
        },
      );
      return {
        ...element,
        content,
        defaultFontName: skill.bodyFont,
        defaultColor: skill.text,
      };
    }
    if (element.type === 'chart') {
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
      fontName: skill?.bodyFont ?? 'Inter',
      outline: { color: skill?.colors[0] ?? '#167E78', width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 8, color: '#A7A7A7' },
    };
    const canvas: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: skill
        ? applySlideDesignSkill(content.elements, options.slideStyle ?? 'consistent-light')
        : content.elements,
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
