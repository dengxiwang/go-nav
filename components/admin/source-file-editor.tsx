"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, toast } from "@heroui/react";
import CodeMirror, {
	EditorView,
	keymap,
	type ViewUpdate,
} from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { yaml as yamlLanguage } from "@codemirror/lang-yaml";
import {
	codeFolding,
	foldCode,
	foldGutter,
	foldKeymap,
	unfoldCode,
} from "@codemirror/language";
import {
	diagnosticCount,
	lintGutter,
	lintKeymap,
	linter,
	type Diagnostic,
} from "@codemirror/lint";
import {
	findNext,
	findPrevious,
	highlightSelectionMatches,
	search,
	SearchQuery,
	setSearchQuery,
} from "@codemirror/search";
import { useSetAtom } from "jotai";
import { BiCode, BiExpand, BiSave } from "react-icons/bi";
import {
	parse as parseYaml,
	parseDocument,
	stringify as stringifyYaml,
} from "yaml";
import { configRevisionAtom, syncDataWithoutDirtyAtom } from "@/lib/store/admin";
import Loading from "./loading";
import { useScrollContainment } from "@/hooks/use-scroll-containment";

const EDITOR_HEIGHT = "calc(100dvh - 242px)";
const EDITOR_LINE_HEIGHT = "1.75rem";
const CONTENT_LEFT_PADDING = 36;

const monoFont =
	'"SFMono-Regular", "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function createYamlDiagnostics(source: string): Diagnostic[] {
	const document = parseDocument(source);

	return [...document.errors, ...document.warnings].map((issue) => {
		const [from = 0, to = from + 1] = issue.pos ?? [0, 1];
		return {
			from,
			to: Math.max(from + 1, to),
			severity: issue.name.includes("Warning") ? "warning" : "error",
			source: "YAML",
			message: issue.message,
		} satisfies Diagnostic;
	});
}

export function SourceFileEditor() {
	const [content, setContent] = useState("");
	const [originalContent, setOriginalContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [fileName, setFileName] = useState("website.json");
	const [formatLabel, setFormatLabel] = useState("JSON");
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const [issueCount, setIssueCount] = useState(0);
	const [isDark, setIsDark] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const syncData = useSetAtom(syncDataWithoutDirtyAtom);
	const setConfigRevision = useSetAtom(configRevisionAtom);
	const editorViewRef = useRef<EditorView | null>(null);
	const editorScrollRef = useScrollContainment<HTMLElement>();
	const editorScrollCleanupRef = useRef<(() => void) | undefined>(undefined);
	const searchInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => () => editorScrollCleanupRef.current?.(), []);

	const syncThemeMode = useCallback(() => {
		const nextIsDark = document.documentElement.classList.contains("dark");
		setIsDark((prev) => (prev === nextIsDark ? prev : nextIsDark));
	}, []);

	const updateEditorStatus = useCallback((viewUpdate: ViewUpdate) => {
		const nextIssueCount = diagnosticCount(viewUpdate.state);
		setIssueCount((prev) => (prev === nextIssueCount ? prev : nextIssueCount));

		if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;

		const position = viewUpdate.state.selection.main.head;
		const line = viewUpdate.state.doc.lineAt(position);
		const nextCursor = {
			line: line.number,
			column: position - line.from + 1,
		};

		setCursor((prev) =>
			prev.line === nextCursor.line && prev.column === nextCursor.column
				? prev
				: nextCursor,
		);
	}, []);

	const resetEditorViewport = useCallback(() => {
		requestAnimationFrame(() => {
			const view = editorViewRef.current;
			if (!view) return;
			view.scrollDOM.scrollTop = 0;
			view.dispatch({ selection: { anchor: 0 } });
			setCursor((prev) =>
				prev.line === 1 && prev.column === 1 ? prev : { line: 1, column: 1 },
			);
		});
	}, []);

	const applySearchQuery = useCallback((nextValue: string) => {
		const view = editorViewRef.current;
		if (!view) return;
		view.dispatch({
			effects: setSearchQuery.of(
				new SearchQuery({
					search: nextValue,
				}),
			),
		});
	}, []);

	const loadContent = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/source-file/");
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				toast.danger(data.error || "加载失败");
				return;
			}
			const data = await res.json();
			const text = typeof data.content === "string" ? data.content : "";
			setContent(text);
			setOriginalContent(text);
			setFileName(
				typeof data.fileName === "string" ? data.fileName : "website.json",
			);
			setFormatLabel(data.format === "yaml" ? "YAML" : "JSON");
			if (typeof data.revision === "string") {
				setConfigRevision(data.revision);
			}
			setIssueCount(0);
			resetEditorViewport();
		} catch {
			toast.danger("加载文件失败");
		} finally {
			setLoading(false);
		}
	}, [resetEditorViewport, setConfigRevision]);

	useEffect(() => {
		loadContent();
	}, [loadContent]);

	useEffect(() => {
		syncThemeMode();
		const observer = new MutationObserver(syncThemeMode);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, [syncThemeMode]);

	const isDirty = content !== originalContent;
	const lineCount = useMemo(
		() => Math.max(content.split("\n").length, 1),
		[content],
	);

	const editorExtensions = useMemo(() => {
		const language = formatLabel === "YAML" ? yamlLanguage() : json();
		const lintExtension =
			formatLabel === "YAML"
				? linter((view) => createYamlDiagnostics(view.state.doc.toString()), {
						delay: 250,
					})
				: linter(jsonParseLinter(), { delay: 250 });
		const editorBackground = isDark ? "var(--default)" : "#ffffff";
		const editorTheme = EditorView.theme(
			{
				"&": {
					backgroundColor: `${editorBackground} !important`,
					fontSize: "13px",
					color: "var(--default-foreground, var(--foreground)) !important",
				},
				"&.cm-focused": {
					outline: "none",
				},
				".cm-editor": {
					backgroundColor: `${editorBackground} !important`,
				},
				".cm-scroller": {
					fontFamily: monoFont,
					lineHeight: EDITOR_LINE_HEIGHT,
					color: "var(--default-foreground, var(--foreground)) !important",
					backgroundColor: `${editorBackground} !important`,
				},
				".cm-content": {
					minHeight: EDITOR_HEIGHT,
					caretColor: "var(--primary) !important",
				},
				".cm-line": {
					paddingLeft: `${CONTENT_LEFT_PADDING}px`,
					paddingRight: "16px",
					marginRight: "8px",
					borderRadius: "0px 6px 6px 0px",
				},
				".cm-gutters": {
					marginRight: `-${CONTENT_LEFT_PADDING}px`,
					paddingLeft: "8px",
					minHeight: EDITOR_HEIGHT,
					borderRight: "none",
					backgroundColor: `${editorBackground} !important`,
					color:
						"color-mix(in srgb, var(--foreground) 44%, transparent) !important",
					position: "relative",
					zIndex: "2",
				},
				".cm-gutterElement": {
					boxSizing: "border-box",
					height: EDITOR_LINE_HEIGHT,
					lineHeight: EDITOR_LINE_HEIGHT,
					display: "flex",
					alignItems: "center",
					borderRadius: "6px 0px 0px 6px",
				},
				".cm-gutter-lint > .cm-gutterElement": {
					borderRadius: "0px",
				},
				".cm-foldGutter": {
					width: "16px",
					minWidth: "16px",
				},
				".cm-lintGutter": {
					width: "12px",
					minWidth: "12px",
					marginLeft: "8px",
				},
				".cm-foldGutter .cm-gutterElement, .cm-lintGutter .cm-gutterElement": {
					padding: 0,
					justifyContent: "center",
					cursor: "pointer",
					color:
						"color-mix(in srgb, var(--foreground) 52%, transparent) !important",
				},
				".cm-foldGutter .cm-gutterElement": {
					fontSize: "16px",
					fontWeight: "700",
				},
				".cm-lintGutter .cm-gutterElement": {
					minWidth: "12px",
					fontSize: "12px",
				},
				".cm-foldGutter .cm-gutterElement:hover": {
					color: "var(--primary) !important",
					backgroundColor:
						"color-mix(in srgb, var(--foreground) 4%, var(--default)) !important",
				},
				".cm-activeLine": {
					backgroundColor:
						"color-mix(in srgb, var(--primary) 6%, var(--default)) !important",
				},
				".cm-activeLineGutter": {
					backgroundColor:
						"color-mix(in srgb, var(--primary) 6%, var(--default)) !important",
					color:
						"color-mix(in srgb, var(--foreground) 56%, transparent) !important",
				},
				".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
					{
						backgroundColor:
							"color-mix(in srgb, var(--primary) 26%, transparent) !important",
					},
				".cm-cursor, .cm-dropCursor": {
					borderLeftColor: "var(--primary) !important",
				},
				".cm-tooltip": {
					borderRadius: "14px",
					border:
						"1px solid color-mix(in srgb, var(--foreground) 10%, transparent) !important",
					backgroundColor:
						"var(--overlay, var(--field-background, var(--background))) !important",
					color: "var(--overlay-foreground, var(--foreground)) !important",
					boxShadow:
						"var(--overlay-shadow, 0 12px 34px rgba(15, 23, 42, 0.14)) !important",
				},
				".cm-diagnostic": {
					fontFamily: "inherit",
				},
				".cm-lint-marker": {
					opacity: "0.88",
					filter: "saturate(0.92)",
				},
				".cm-lint-marker-error, .cm-lintPoint-error": {
					color:
						"color-mix(in srgb, var(--danger) 76%, var(--foreground)) !important",
				},
				".cm-lint-marker-warning, .cm-lintPoint-warning": {
					color:
						"color-mix(in srgb, var(--warning) 82%, var(--foreground)) !important",
				},
				".cm-searchMatch": {
					borderRadius: "6px",
					boxShadow:
						"inset 0 0 0 1px color-mix(in srgb, var(--warning) 48%, transparent) !important",
					backgroundColor:
						"color-mix(in srgb, var(--warning) 20%, transparent) !important",
				},
				".cm-searchMatch.cm-searchMatch-selected": {
					boxShadow:
						"inset 0 0 0 1px color-mix(in srgb, var(--primary) 60%, transparent) !important",
					backgroundColor:
						"color-mix(in srgb, var(--primary) 18%, transparent) !important",
				},
				".cm-matchingBracket": {
					borderRadius: "4px",
					backgroundColor:
						"color-mix(in srgb, var(--primary) 14%, transparent) !important",
					boxShadow:
						"inset 0 0 0 1px color-mix(in srgb, var(--primary) 36%, transparent) !important",
				},
				".cm-nonmatchingBracket": {
					borderRadius: "4px",
					backgroundColor:
						"color-mix(in srgb, var(--danger) 16%, transparent) !important",
					boxShadow:
						"inset 0 0 0 1px color-mix(in srgb, var(--danger) 40%, transparent) !important",
				},
				".cm-lintRange-error": {
					backgroundColor:
						"color-mix(in srgb, var(--danger) 18%, transparent) !important",
				},
				".cm-lintRange-warning": {
					backgroundColor:
						"color-mix(in srgb, var(--warning) 18%, transparent) !important",
				},
				".cm-tooltip-autocomplete ul li[aria-selected]": {
					backgroundColor:
						"color-mix(in srgb, var(--primary) 12%, transparent) !important",
					color: "var(--foreground) !important",
				},
			},
			{ dark: isDark },
		);

		return [
			language,
			search(),
			highlightSelectionMatches(),
			codeFolding(),
			foldGutter({ openText: "▾", closedText: "▸" }),
			lintExtension,
			lintGutter(),
			keymap.of([...foldKeymap, ...lintKeymap]),
			EditorView.lineWrapping,
			EditorView.theme({
				".cm-foldPlaceholder": {
					borderRadius: "6px",
					border: "none",
					backgroundColor: isDark
						? "rgba(255,255,255,0.08)"
						: "rgba(15,23,42,0.08)",
					color: isDark ? "#d4d4d8" : "#334155",
					padding: "0 6px",
				},
			}),
			editorTheme,
		];
	}, [formatLabel, isDark]);

	const handleSave = useCallback(async () => {
		setSaving(true);
		try {
			const res = await fetch("/api/source-file/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.danger(data.error || "保存失败");
				return;
			}
			const nextContent =
				typeof data.content === "string" ? data.content : content;
			setContent(nextContent);
			setOriginalContent(nextContent);
			setFileName(typeof data.fileName === "string" ? data.fileName : fileName);
			setFormatLabel(data.format === "yaml" ? "YAML" : "JSON");
			if (data.websiteData) {
				syncData({ websiteData: data.websiteData });
			}
			if (typeof data.revision === "string") {
				setConfigRevision(data.revision);
			}
			toast.success("已保存");
		} catch {
			toast.danger("保存失败");
		} finally {
			setSaving(false);
		}
	}, [content, fileName, setConfigRevision, syncData]);

	const handleFormat = useCallback(() => {
		try {
			const nextContent =
				formatLabel === "YAML"
					? stringifyYaml(parseYaml(content), {
							indent: 2,
							lineWidth: 0,
						}).trimEnd()
					: JSON.stringify(JSON.parse(content), null, 2);
			setContent(nextContent);
			toast.success("已格式化，记得保存");
		} catch {
			toast.danger("格式化失败，请先修正当前语法错误");
		}
	}, [content, formatLabel]);

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchValue(value);
			applySearchQuery(value);
		},
		[applySearchQuery],
	);

	const handleFindNext = useCallback(() => {
		const view = editorViewRef.current;
		if (!view || !searchValue.trim()) return;
		findNext(view);
		view.focus();
	}, [searchValue]);

	const handleFindPrevious = useCallback(() => {
		const view = editorViewRef.current;
		if (!view || !searchValue.trim()) return;
		findPrevious(view);
		view.focus();
	}, [searchValue]);

	const handleFoldCurrent = useCallback(() => {
		const view = editorViewRef.current;
		if (!view) return;
		foldCode(view);
		view.focus();
	}, []);

	const handleUnfoldCurrent = useCallback(() => {
		const view = editorViewRef.current;
		if (!view) return;
		unfoldCode(view);
		view.focus();
	}, []);

	useEffect(() => {
		const handler = async (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
				event.preventDefault();
				event.stopPropagation();
				requestAnimationFrame(() => {
					searchInputRef.current?.focus();
					searchInputRef.current?.select();
				});
				return;
			}
			if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "s")
				return;
			event.preventDefault();
			event.stopPropagation();
			if (event.repeat || saving || !isDirty) return;
			await handleSave();
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [handleSave, isDirty, saving]);

	if (loading) {
		return <Loading />;
	}

	return (
		<div
			className="flex flex-col gap-4"
			style={{
				minHeight: `calc(100dvh - 106px)`,
			}}
		>
			<div className="flex items-start justify-between gap-3 flex-col">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						编辑 {fileName}
					</h3>
					<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
						直接编辑源文件内容，保存时会验证 JSON / YAML 格式（当前输出：
						{formatLabel}）。
						支持当前结构折叠、精简搜索、语法错误提示和一键格式化。
					</p>
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					<Input
						ref={searchInputRef}
						variant="primary"
						placeholder="搜索当前文件"
						value={searchValue}
						onChange={(event) => handleSearchChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								if (event.shiftKey) handleFindPrevious();
								else handleFindNext();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								searchInputRef.current?.blur();
								editorViewRef.current?.focus();
							}
						}}
						className="w-full min-w-64 flex-1 h-8"
					/>
					<Button
						variant="secondary"
						className="h-8 shrink-0"
						isDisabled={!searchValue.trim()}
						onPress={handleFindPrevious}
					>
						上一个
					</Button>
					<Button
						variant="secondary"
						className="h-8 shrink-0"
						isDisabled={!searchValue.trim()}
						onPress={handleFindNext}
					>
						下一个
					</Button>
					<Button
						variant="secondary"
						className="h-8 shrink-0"
						onPress={handleFoldCurrent}
					>
						<BiCode className="size-4" />
						<span className="hidden sm:inline">折叠当前</span>
					</Button>
					<Button
						variant="secondary"
						className="h-8 shrink-0"
						onPress={handleUnfoldCurrent}
					>
						<BiExpand className="size-4" />
						<span className="hidden sm:inline">展开当前</span>
					</Button>
					<Button
						variant="secondary"
						className="h-8 shrink-0"
						isDisabled={saving}
						onPress={handleFormat}
					>
						<span>格式化</span>
					</Button>
					<Button
						variant="primary"
						className="h-8 shrink-0"
						isDisabled={!isDirty || saving}
						isPending={saving}
						onPress={handleSave}
					>
						<BiSave className="size-4" />
						<span className="hidden sm:inline">
							{saving ? "保存中..." : isDirty ? "保存" : "已保存"}
						</span>
					</Button>
				</div>
			</div>

				<div
					className={`overflow-hidden rounded-xl ${isDark ? "bg-background dark:border-white/8" : "border border-gray-200 bg-white"}`}
				>
				<CodeMirror
					value={content}
					height={EDITOR_HEIGHT}
					theme={isDark ? "dark" : "light"}
					basicSetup={{
						lineNumbers: false,
						foldGutter: false,
						highlightActiveLineGutter: true,
						dropCursor: false,
						allowMultipleSelections: false,
						indentOnInput: true,
						bracketMatching: true,
						closeBrackets: true,
						autocompletion: true,
						highlightSelectionMatches: false,
						searchKeymap: false,
						foldKeymap: false,
						lintKeymap: false,
					}}
					indentWithTab
					extensions={editorExtensions}
					onCreateEditor={(view) => {
						editorScrollCleanupRef.current?.();
						editorScrollCleanupRef.current = editorScrollRef(view.scrollDOM);
						editorViewRef.current = view;
						setCursor({ line: 1, column: 1 });
						setIssueCount(diagnosticCount(view.state));
						if (searchValue) applySearchQuery(searchValue);
					}}
					onChange={(value) => setContent(value)}
					onUpdate={updateEditorStatus}
				/>

				<div className="flex items-center flex-wrap justify-between gap-3 border-t px-4 py-2 text-[11px] ">
					<span>
						第 {cursor.line} 行，第 {cursor.column} 列
					</span>
					<span>
						共 {lineCount} 行，{content.length} 个字符，
						{issueCount > 0 ? `发现 ${issueCount} 个语法问题` : "语法正常"}
					</span>
				</div>
			</div>
		</div>
	);
}
