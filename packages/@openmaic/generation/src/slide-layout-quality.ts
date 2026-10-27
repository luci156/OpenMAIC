interface LayoutElement {
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  content?: unknown;
  lineHeight?: number;
  paragraphSpace?: number;
}

interface LayoutTextElement extends LayoutElement {
  type: 'text';
  content?: unknown;
}

interface TextBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function plainText(value: string): string {
  return value
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

function glyphWidth(character: string, fontSize: number): number {
  if (/\s/u.test(character)) return fontSize * 0.28;
  if (/[^\u0000-\u00ff]/u.test(character)) return fontSize;
  if (/[MW@#%&]/u.test(character)) return fontSize * 0.78;
  if (/[il.,'!:;|]/u.test(character)) return fontSize * 0.3;
  return fontSize * 0.53;
}

function wrappedLineCount(text: string, maxWidth: number, fontSize: number): number {
  let lines = 1;
  let lineWidth = 0;
  for (const paragraph of text.split(/\n+/u)) {
    if (lineWidth > 0) {
      lines += 1;
      lineWidth = 0;
    }
    const words = paragraph.split(/\s+/u).filter(Boolean);
    for (const word of words) {
      const width = Array.from(word).reduce((sum, char) => sum + glyphWidth(char, fontSize), 0);
      const spaceWidth = lineWidth > 0 ? fontSize * 0.28 : 0;
      if (lineWidth > 0 && lineWidth + spaceWidth + width > maxWidth) {
        lines += 1;
        lineWidth = width;
      } else {
        lineWidth += spaceWidth + width;
      }
      if (lineWidth > maxWidth) {
        lines += Math.floor((lineWidth - 1) / maxWidth);
        lineWidth %= maxWidth;
      }
    }
  }
  return lines;
}

function estimateTextContentHeight(element: LayoutTextElement): number {
  const content = typeof element.content === 'string' ? element.content : '';
  const paragraphs = [...content.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p\s*>/gi)];
  const blocks = paragraphs.length
    ? paragraphs.map((match) => ({ attrs: match[1] ?? '', text: plainText(match[2] ?? '') }))
    : [{ attrs: '', text: plainText(content) }];
  const innerWidth = Math.max(1, element.width - 20);
  let height = 20;

  for (const block of blocks) {
    if (!block.text) continue;
    const style = block.attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
    const fontSize = Number(style.match(/font-size\s*:\s*([\d.]+)px/i)?.[1]) || 18;
    const lineHeightValue = style.match(/line-height\s*:\s*([\d.]+)(px)?/i);
    const lineHeight = lineHeightValue
      ? lineHeightValue[2]
        ? Number(lineHeightValue[1])
        : Number(lineHeightValue[1]) * fontSize
      : (element.lineHeight ?? 1.5) * fontSize;
    height += wrappedLineCount(block.text, innerWidth, fontSize) * lineHeight;
    height += element.paragraphSpace ?? 5;
  }

  return height;
}

/** Detect common generated-slide text collisions and clipped text frames. */
export function findSlideLayoutIssues(
  elements: readonly LayoutElement[],
  canvasWidth = 1000,
  canvasHeight = 562.5,
): string[] {
  const textBoxes = elements
    .filter((element): element is LayoutTextElement => element.type === 'text')
    .map((element, index) => ({
      id: `text ${index + 1}`,
      left: element.left,
      top: element.top,
      right: element.left + element.width,
      bottom: element.top + element.height,
      element,
    }));
  const issues: string[] = [];

  for (const box of textBoxes) {
    if (box.left < 0 || box.top < 0 || box.right > canvasWidth || box.bottom > canvasHeight) {
      issues.push(`${box.id} extends beyond the ${canvasWidth} × ${canvasHeight} slide canvas.`);
    }
    const estimatedHeight = estimateTextContentHeight(box.element);
    if (estimatedHeight > box.element.height + 12) {
      issues.push(
        `${box.id} needs about ${Math.ceil(estimatedHeight)} px of height but its text box is ${Math.ceil(box.element.height)} px high; shorten the copy, enlarge/reposition the box, or move nearby content.`,
      );
    }
  }

  for (let i = 0; i < textBoxes.length; i += 1) {
    const first = textBoxes[i]!;
    for (let j = i + 1; j < textBoxes.length; j += 1) {
      const second = textBoxes[j]!;
      const overlapWidth = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapHeight = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapWidth > 4 && overlapHeight > 4) {
        issues.push(
          `${first.id} overlaps ${second.id} by ${Math.ceil(overlapWidth)} × ${Math.ceil(overlapHeight)} px.`,
        );
      }
    }
  }

  return issues;
}
