import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import type { VirtualElement } from "@popperjs/core";
import { Box, Check, Image as ImageIcon, MapPin, Music2, UserRound, Volume2 } from "lucide-react";
import type { EntityType } from "../../constants/domain";
import styles from "./RichPromptEditor.module.scss";

export const PROMPT_MENTION_CATEGORY = {
  CHARACTER: "character",
  SCENE: "scene",
  IMAGE: "image",
  AUDIO: "audio",
  OTHER: "other",
} as const;

export type PromptMentionCategory =
  (typeof PROMPT_MENTION_CATEGORY)[keyof typeof PROMPT_MENTION_CATEGORY];

export type PromptMentionOption = {
  id: number;
  kind: Exclude<EntityType, "project">;
  name: string;
  imageUrl?: string;
  isBound: boolean;
  category: PromptMentionCategory;
  description?: string;
  media: Array<"image" | "audio">;
  searchText?: string;
};

type RichPromptEditorProps = {
  value: string;
  options: PromptMentionOption[];
  onChange: (value: string) => void;
  onSelectMention: (option: PromptMentionOption) => void | Promise<void>;
  onRemoveMentions?: (options: PromptMentionOption[]) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  maxLength?: number;
};

const MENTION_SELECTOR = "[data-prompt-mention='true']";

function getMentionKey(kind: PromptMentionOption["kind"], id: number) {
  return `${kind}:${id}`;
}

function getMentionKeys(root: HTMLElement) {
  return new Set(
    Array.from(root.querySelectorAll<HTMLElement>(MENTION_SELECTOR))
      .map((node) => {
        const kind = node.dataset.mentionKind as PromptMentionOption["kind"] | undefined;
        const id = Number(node.dataset.mentionId || 0);
        return kind && id ? getMentionKey(kind, id) : "";
      })
      .filter(Boolean),
  );
}

function getMentionForName(name: string, options: PromptMentionOption[]) {
  const matches = options.filter((option) => option.name === name);
  if (matches.length === 1) return matches[0];
  const boundMatches = matches.filter((option) => option.isBound);
  return boundMatches.length === 1 ? boundMatches[0] : null;
}

function serializeEditor(root: HTMLElement) {
  const serializeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof HTMLElement)) return node.textContent || "";
    if (node.matches(MENTION_SELECTOR)) return `@${node.dataset.mentionName || ""}`;
    if (node.tagName === "BR") return "\n";

    const content = Array.from(node.childNodes).map(serializeNode).join("");
    return node.tagName === "DIV" || node.tagName === "P" ? `${content}\n` : content;
  };

  return Array.from(root.childNodes)
    .map(serializeNode)
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\n$/, "");
}

function createMentionNode(option: PromptMentionOption) {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.promptMention = "true";
  chip.dataset.mentionId = String(option.id);
  chip.dataset.mentionKind = option.kind;
  chip.dataset.mentionName = option.name;
  chip.className = styles.mentionChip;

  const thumb = document.createElement("span");
  thumb.className = styles.mentionThumbnail;
  if (option.imageUrl) {
    const image = document.createElement("img");
    image.src = option.imageUrl;
    image.alt = "";
    image.className = styles.thumbnailImage;
    thumb.append(image);
  }

  const label = document.createElement("span");
  label.textContent = `@${option.name}`;
  chip.append(thumb, label);
  return chip;
}

function renderValue(root: HTMLElement, value: string, options: PromptMentionOption[]) {
  root.replaceChildren();
  const names = Array.from(new Set(options.map((option) => option.name))).sort(
    (left, right) => right.length - left.length,
  );
  if (!names.length || !value.includes("@")) {
    root.append(document.createTextNode(value));
    return;
  }

  let cursor = 0;
  while (cursor < value.length) {
    const candidates = names
      .map((name) => ({ name, index: value.indexOf(`@${name}`, cursor) }))
      .filter((candidate) => candidate.index >= 0)
      .sort((left, right) => left.index - right.index || right.name.length - left.name.length);
    const next = candidates[0];
    if (!next) {
      root.append(document.createTextNode(value.slice(cursor)));
      break;
    }
    if (next.index > cursor) {
      root.append(document.createTextNode(value.slice(cursor, next.index)));
    }
    const option = getMentionForName(next.name, options);
    root.append(option ? createMentionNode(option) : document.createTextNode(`@${next.name}`));
    cursor = next.index + next.name.length + 1;
  }
}

function insertPlainTextAtSelection(root: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = document.createTextNode(text.replace(/\r\n?/g, "\n"));
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function getEditableTextBeforeCaret(anchorNode: Node, anchorOffset: number) {
  let text = "";
  let previousNode: Node | null = null;

  if (anchorNode.nodeType === Node.TEXT_NODE) {
    text = (anchorNode.textContent || "").slice(0, anchorOffset);
    previousNode = anchorNode.previousSibling;
  } else if (anchorNode instanceof HTMLElement) {
    previousNode = anchorNode.childNodes[Math.min(anchorOffset, anchorNode.childNodes.length) - 1];
  }

  while (previousNode) {
    if (previousNode instanceof HTMLElement) {
      if (previousNode.matches(MENTION_SELECTOR) || previousNode.tagName === "BR") break;
      if (previousNode.tagName === "DIV" || previousNode.tagName === "P") break;
    }
    if (previousNode.nodeType !== Node.TEXT_NODE) break;
    text = `${previousNode.textContent || ""}${text}`;
    previousNode = previousNode.previousSibling;
  }

  return text;
}

function getMentionQuery(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed || !root.contains(selection.anchorNode)) {
    return null;
  }
  const text = getEditableTextBeforeCaret(selection.anchorNode as Node, selection.anchorOffset);
  const match = text.match(/(?:^|[\s([{"'，。；：|])@([^\s@]*)$/);
  return match ? match[1] : null;
}

function getCaretRect(range: Range | null, editor: HTMLElement | null) {
  if (!range || !editor) return new DOMRect();

  const directRect = range.getBoundingClientRect();
  if (directRect.height || directRect.width) return directRect;

  if (range.endContainer.nodeType === Node.TEXT_NODE && range.endOffset > 0) {
    const probe = range.cloneRange();
    probe.setStart(range.endContainer, range.endOffset - 1);
    const probeRect = probe.getBoundingClientRect();
    if (probeRect.height || probeRect.width) {
      return new DOMRect(probeRect.right, probeRect.top, 0, probeRect.height);
    }
  }

  const editorRect = editor.getBoundingClientRect();
  return new DOMRect(editorRect.left + 16, editorRect.top + 12, 0, 28);
}

const CATEGORY_CONFIG: Array<{
  category: PromptMentionCategory;
  label: string;
  icon: typeof UserRound;
}> = [
  { category: PROMPT_MENTION_CATEGORY.CHARACTER, label: "人物", icon: UserRound },
  { category: PROMPT_MENTION_CATEGORY.SCENE, label: "场景", icon: MapPin },
  { category: PROMPT_MENTION_CATEGORY.IMAGE, label: "图片资产", icon: ImageIcon },
  { category: PROMPT_MENTION_CATEGORY.AUDIO, label: "音频资产", icon: Music2 },
  { category: PROMPT_MENTION_CATEGORY.OTHER, label: "其他资产", icon: Box },
];

export function RichPromptEditor({
  value,
  options,
  onChange,
  onSelectMention,
  onRemoveMentions,
  placeholder = "描述画面、动作、情绪和镜头意图，输入 @ 引用角色或场景资产",
  className = "",
  autoFocus = false,
  maxLength = 10000,
}: RichPromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const caretRangeRef = useRef<Range | null>(null);
  const mentionKeysRef = useRef<Set<string>>(new Set());
  const mentionKeysBeforeInputRef = useRef<Set<string> | null>(null);
  const virtualCaretRef = useRef<VirtualElement>({
    getBoundingClientRect: () => getCaretRect(caretRangeRef.current, editorRef.current),
  });
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const {
    styles: popperStyles,
    attributes: popperAttributes,
    update: updatePopper,
  } = usePopper(query !== null ? virtualCaretRef.current : null, popperElement, {
    placement: "bottom-start",
    strategy: "fixed",
    modifiers: [
      { name: "offset", options: { offset: [0, 8] } },
      {
        name: "flip",
        options: { fallbackPlacements: ["top-start", "right-start", "left-start"] },
      },
      { name: "preventOverflow", options: { boundary: "viewport", padding: 8 } },
    ],
  });

  const normalizedQuery = query?.trim().toLowerCase() || "";
  const filteredOptions = CATEGORY_CONFIG.flatMap(({ category }) =>
    options.filter((option) => {
      if (option.category !== category) return false;
      const searchable = `${option.name} ${option.description || ""} ${option.searchText || ""}`;
      return searchable.toLowerCase().includes(normalizedQuery);
    }),
  );

  useEffect(() => {
    if (query === null) return;
    const active = popperElement?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, popperElement, query]);

  useEffect(() => {
    if (query === null) return;
    const updatePosition = () => void updatePopper?.();
    const editor = editorRef.current;
    updatePosition();
    editor?.addEventListener("scroll", updatePosition, { passive: true });
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      editor?.removeEventListener("scroll", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [query, updatePopper]);

  useEffect(() => {
    if (activeIndex < filteredOptions.length) return;
    setActiveIndex(Math.max(0, filteredOptions.length - 1));
  }, [activeIndex, filteredOptions.length]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (serializeEditor(editor) !== value) renderValue(editor, value, options);
    mentionKeysRef.current = getMentionKeys(editor);
  }, [options, value]);

  useEffect(() => {
    if (!autoFocus) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [autoFocus]);

  const syncMentionMenu = (resetActiveIndex = true) => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextQuery = getMentionQuery(editor);
    if (nextQuery !== null) {
      const selection = window.getSelection();
      if (selection?.rangeCount) caretRangeRef.current = selection.getRangeAt(0).cloneRange();
      virtualCaretRef.current.contextElement = editor;
      window.requestAnimationFrame(() => void updatePopper?.());
    } else {
      caretRangeRef.current = null;
    }
    setQuery(nextQuery);
    if (resetActiveIndex) setActiveIndex(0);
  };

  const syncValue = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextValue = serializeEditor(editor);
    if (nextValue.length > maxLength) {
      renderValue(editor, value, options);
      mentionKeysRef.current = getMentionKeys(editor);
      mentionKeysBeforeInputRef.current = null;
      return;
    }

    const previousMentionKeys = mentionKeysBeforeInputRef.current ?? mentionKeysRef.current;
    const nextMentionKeys = getMentionKeys(editor);
    const removedOptions = options.filter(
      (option) =>
        previousMentionKeys.has(getMentionKey(option.kind, option.id)) &&
        !nextMentionKeys.has(getMentionKey(option.kind, option.id)),
    );
    mentionKeysRef.current = nextMentionKeys;
    mentionKeysBeforeInputRef.current = null;
    onChange(nextValue);
    if (removedOptions.length) void onRemoveMentions?.(removedOptions);
    syncMentionMenu();
  };

  const insertMention = async (option: PromptMentionOption) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const anchor = selection.anchorNode;
    if (anchor?.nodeType === Node.TEXT_NODE) {
      const text = anchor.textContent || "";
      const before = text.slice(0, selection.anchorOffset);
      const atIndex = before.lastIndexOf("@");
      if (atIndex >= 0) {
        range.setStart(anchor, atIndex);
        range.deleteContents();
      }
    }

    const chip = createMentionNode(option);
    const spacer = document.createTextNode(" ");
    range.insertNode(spacer);
    range.insertNode(chip);
    range.setStartAfter(spacer);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    caretRangeRef.current = null;
    mentionKeysRef.current = getMentionKeys(editor);
    mentionKeysBeforeInputRef.current = null;
    setQuery(null);
    onChange(serializeEditor(editor));
    await onSelectMention(option);
    editor.focus();
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-controls={query !== null ? "prompt-mention-listbox" : undefined}
        aria-activedescendant={
          query !== null && filteredOptions.length ? `prompt-mention-${activeIndex}` : undefined
        }
        data-placeholder={placeholder}
        className={styles.editor}
        onPaste={(event) => {
          const editor = editorRef.current;
          if (!editor) return;

          event.preventDefault();
          mentionKeysBeforeInputRef.current = getMentionKeys(editor);
          const plainText = event.clipboardData.getData("text/plain");
          if (insertPlainTextAtSelection(editor, plainText)) syncValue();
        }}
        onBeforeInput={() => {
          const editor = editorRef.current;
          mentionKeysBeforeInputRef.current = editor ? getMentionKeys(editor) : null;
        }}
        onInput={syncValue}
        onMouseUp={() => syncMentionMenu()}
        onKeyUp={(event) => {
          if (
            ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)
          ) {
            syncMentionMenu(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        onKeyDown={(event) => {
          if (query === null || filteredOptions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % filteredOptions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + filteredOptions.length) % filteredOptions.length,
            );
          } else if (event.key === "Enter") {
            event.preventDefault();
            void insertMention(filteredOptions[activeIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setQuery(null);
          }
        }}
      />

      <div className={styles.characterCount}>
        {value.length} / {maxLength}
      </div>

      {query !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={setPopperElement}
              id="prompt-mention-listbox"
              role="listbox"
              style={popperStyles.popper}
              {...popperAttributes.popper}
              className={styles.mentionMenu}
            >
              {CATEGORY_CONFIG.map(({ category, label: categoryLabel, icon: CategoryIcon }) => {
                const group = filteredOptions.filter((option) => option.category === category);
                if (!group.length) return null;
                return (
                  <div key={category} className={styles.category}>
                    <div className={styles.categoryHeader}>
                      <CategoryIcon className={styles.categoryIcon} />
                      {categoryLabel}
                    </div>
                    {group.map((option) => {
                      const optionIndex = filteredOptions.indexOf(option);
                      return (
                        <button
                          key={`${option.kind}:${option.id}`}
                          id={`prompt-mention-${optionIndex}`}
                          role="option"
                          aria-selected={optionIndex === activeIndex}
                          data-option-index={optionIndex}
                          type="button"
                          className={
                            optionIndex === activeIndex ? styles.optionActive : styles.option
                          }
                          onMouseDown={(event) => {
                            event.preventDefault();
                            void insertMention(option);
                          }}
                        >
                          <span className={styles.optionThumbnail}>
                            {option.imageUrl ? (
                              <img src={option.imageUrl} alt="" className={styles.thumbnailImage} />
                            ) : option.media.includes("audio") ? (
                              <Volume2 className={styles.audioIcon} />
                            ) : (
                              <ImageIcon className={styles.imageIcon} />
                            )}
                          </span>
                          <span className={styles.optionContent}>
                            <span className={styles.optionName}>{option.name}</span>
                            <span className={styles.optionMeta}>
                              <span className={styles.optionDescription}>
                                {option.description || "可引用资产"}
                              </span>
                              {option.media.map((media) => (
                                <span key={media} className={styles.mediaBadge}>
                                  {media === "image" ? "图片" : "音频"}
                                </span>
                              ))}
                            </span>
                          </span>
                          {option.isBound ? <Check className={styles.boundIcon} /> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {filteredOptions.length === 0 ? (
                <div className={styles.emptyState}>没有匹配的人物、场景或其他资产</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
