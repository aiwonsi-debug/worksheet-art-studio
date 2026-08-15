import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import WorksheetCanvas from "@/components/WorksheetCanvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { createEmptyCanvas, type AssetKind, type StudioLayer, type StudioTool, type WorksheetCanvasState } from "@/lib/studioTypes";
import { downloadWorksheet } from "@/lib/exportWorksheet";
import { prepareCustomClipartPrompt } from "@/lib/clipartPrompt";
import { resolveStudioShortcut } from "@/lib/studioShortcuts";
import { insertAssetOnCanvas } from "@/lib/assetInsertion";
import { clipartSubjectPresets } from "@/lib/clipartPresets";
import { historyControlAvailability } from "@/lib/canvasHistory";
import { createShapeLayer, createTextLayer, layerKindLabel } from "@/lib/drawingElements";
import { duplicateCanvasLayer, patchCanvasLayer, removeCanvasLayer, reorderCanvasLayer } from "@/lib/selectedElementActions";
import "@/styles/drawingTools.css";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Archive, ArrowDownToLine, ArrowRight, Brush, ChevronRight, Circle, CircleHelp, Copy, Diamond, Eraser, FilePlus2, FolderOpen, Grid2X2, ImagePlus, Layers3, Loader2, LogOut, Minus, MoreHorizontal, MousePointer2, PaintBucket, Palette, PenLine, Pipette, Plus, Redo2, RotateCcw, Sparkles, Square, Star, Trash2, Triangle, Type, Undo2, Upload, WandSparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

const kindNames: Record<AssetKind, string> = { clipart: "Clipart", border: "Border", header: "Header", drawing: "Drawing", upload: "Upload" };
const defaultCanvas = createEmptyCanvas();
const emptySnapshot = JSON.stringify({ title: "Untitled worksheet", canvas: defaultCanvas });

function emptyCanvasData() { return JSON.stringify(defaultCanvas); }

function parseCanvasData(value: string): WorksheetCanvasState {
  try {
    const data = JSON.parse(value) as WorksheetCanvasState;
    if (Array.isArray(data.layers)) return { layers: data.layers, transparentBackground: Boolean(data.transparentBackground) };
  } catch { /* show an empty, usable canvas if legacy data is invalid */ }
  return createEmptyCanvas();
}

function ToolButton({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><button className={`tool-button ${active ? "is-active" : ""}`} onClick={onClick} aria-label={label}>{children}</button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const utils = trpc.useUtils();
  const { data: projects = [], error: projectsError, refetch: refetchProjects } = trpc.project.list.useQuery(undefined, { enabled: Boolean(user) });
  const { data: assets = [], isLoading: assetsLoading, error: assetsError, refetch: refetchAssets } = trpc.asset.list.useQuery(undefined, { enabled: Boolean(user) });
  const [canvas, setCanvas] = useState<WorksheetCanvasState>(createEmptyCanvas);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("Untitled worksheet");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<StudioTool>("select");
  const [brushColor, setBrushColor] = useState("#4263eb");
  const [brushSize, setBrushSize] = useState(12);
  const [pressureSensitivity, setPressureSensitivity] = useState(1);
  const [rightPane, setRightPane] = useState<"properties" | "layers" | "assets">("properties");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [clipartOpen, setClipartOpen] = useState(false);
  const [penSetupOpen, setPenSetupOpen] = useState(false);
  const [penDetected, setPenDetected] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<WorksheetCanvasState[]>([]);
  const [canvasFuture, setCanvasFuture] = useState<WorksheetCanvasState[]>([]);
  const [exporting, setExporting] = useState<"png" | "svg" | "pdf" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedLayer = useMemo(() => canvas.layers.find((layer) => layer.id === selectedId) ?? null, [canvas.layers, selectedId]);
  const historyAvailability = useMemo(() => historyControlAvailability(canvasHistory.length, canvasFuture.length), [canvasFuture.length, canvasHistory.length]);
  const currentSnapshot = useMemo(() => JSON.stringify({ title: title.trim(), canvas }), [title, canvas]);
  const isDirty = projectId ? currentSnapshot !== savedSnapshot : currentSnapshot !== emptySnapshot;
  const canSave = projectId ? isDirty : true;
  const workspaceError = projectsError ?? assetsError;

  const createProject = trpc.project.create.useMutation({ onSuccess: (project, variables) => { setProjectId(project.id); setSavedSnapshot(JSON.stringify({ title: variables.title.trim(), canvas: JSON.parse(variables.canvasData) })); utils.project.list.invalidate(); toast.success("Worksheet saved to your workspace."); }, onError: (error) => toast.error(error.message || "Worksheet could not be saved. Please try again.") });
  const updateProject = trpc.project.update.useMutation({ onSuccess: (_, variables) => { setSavedSnapshot(JSON.stringify({ title: variables.title?.trim(), canvas: variables.canvasData ? JSON.parse(variables.canvasData) : canvas })); utils.project.list.invalidate(); toast.success("All changes saved."); }, onError: (error) => toast.error(error.message || "Changes could not be saved. Please try again.") });
  const removeProject = trpc.project.remove.useMutation({ onSuccess: () => { utils.project.list.invalidate(); toast.success("Worksheet removed."); }, onError: (error) => toast.error(error.message || "Worksheet could not be removed.") });
  const generateAsset = trpc.asset.generate.useMutation({ onSuccess: (asset) => { utils.asset.list.invalidate(); addAssetToCanvas(asset); toast.success("Your new asset is ready in the canvas and library."); }, onError: (error) => toast.error(error.message || "Artwork could not be generated. Please try again.") });
  const saveAsset = trpc.asset.save.useMutation({ onSuccess: (asset) => { utils.asset.list.invalidate(); addAssetToCanvas(asset); toast.success("Asset added to your personal library."); }, onError: (error) => toast.error(error.message || "Asset could not be uploaded. Please try again.") });
  const deleteAsset = trpc.asset.remove.useMutation({ onSuccess: () => utils.asset.list.invalidate(), onError: (error) => toast.error(error.message || "Asset could not be removed.") });

  useEffect(() => {
    if (projects.length && projectId === null) openProject(projects[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      const command = resolveStudioShortcut(event);
      const isDelete = event.key.toLowerCase() === "delete" || event.key.toLowerCase() === "backspace";
      const isDuplicate = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d";
      if (!command && !isDelete && !isDuplicate) return;
      event.preventDefault();
      if (command === "brush") setTool("brush");
      if (command === "eraser") setTool("eraser");
      if (command === "undo") undoCanvas();
      if (command === "redo") redoCanvas();
      if (command === "save") saveProject();
      if (command === "export") exportWorksheet("pdf");
      if (isDelete) removeSelected();
      if (isDuplicate) duplicateSelected();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canvas, canvasFuture, canvasHistory, projectId, title]);

  function openProject(project: { id: number; title: string; canvasData: string }) {
    setProjectId(project.id);
    setTitle(project.title);
    const projectCanvas = parseCanvasData(project.canvasData);
    setCanvas(projectCanvas);
    setSavedSnapshot(JSON.stringify({ title: project.title.trim(), canvas: projectCanvas }));
    setSelectedId(null);
    setProjectsOpen(false);
  }

  function startFresh() {
    setProjectId(null); setTitle("Untitled worksheet"); setCanvas(createEmptyCanvas()); setSavedSnapshot(null); setSelectedId(null); setTool("select"); setProjectsOpen(false);
  }

  function saveProject() {
    const canvasData = JSON.stringify(canvas);
    if (projectId) updateProject.mutate({ projectId, title, canvasData });
    else createProject.mutate({ title, canvasData });
  }

  function checkpointCanvas() {
    setCanvasHistory((current) => [...current.slice(-29), canvas]);
    setCanvasFuture([]);
  }

  function undoCanvas() {
    const previous = canvasHistory.at(-1);
    if (!previous) return;
    setCanvasHistory((current) => current.slice(0, -1));
    setCanvasFuture((current) => [canvas, ...current].slice(0, 30));
    setCanvas(previous);
    setSelectedId(null);
    toast.message("Undid the last canvas edit.");
  }

  function redoCanvas() {
    const next = canvasFuture[0];
    if (!next) return;
    setCanvasFuture((current) => current.slice(1));
    setCanvasHistory((current) => [...current.slice(-29), canvas]);
    setCanvas(next);
    setSelectedId(null);
    toast.message("Redid the canvas edit.");
  }

  function addAssetToCanvas(asset: { id: number; name: string; url: string; kind: string }) {
    const insertion = insertAssetOnCanvas(canvas, asset, nanoid());
    checkpointCanvas();
    setCanvas(insertion.canvas);
    setSelectedId(insertion.selectedId);
    setTool("select");
    setRightPane("properties");
  }

  function updateSelected(patch: Partial<StudioLayer>) {
    if (!selectedId) return;
    setCanvas((current) => patchCanvasLayer(current, selectedId, patch));
  }

  function removeSelected() {
    if (!selectedId) return;
    checkpointCanvas();
    setCanvas((current) => removeCanvasLayer(current, selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedLayer) return;
    checkpointCanvas();
    const duplicated = duplicateCanvasLayer(canvas, selectedLayer.id, nanoid());
    if (!duplicated) return;
    setCanvas(duplicated.canvas);
    setSelectedId(duplicated.selectedId);
    setRightPane("properties");
  }

  function addDrawingElement(nextTool: StudioTool) {
    if (nextTool === "select" || nextTool === "brush" || nextTool === "eraser" || nextTool === "bucket" || nextTool === "eyedropper") { setTool(nextTool); return; }
    checkpointCanvas();
    const layer = nextTool === "text" ? createTextLayer() : createShapeLayer(nextTool);
    setCanvas((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedId(layer.id);
    setTool("select");
    setRightPane("properties");
  }

  function moveLayer(id: string, direction: "forward" | "back") {
    checkpointCanvas();
    setCanvas((current) => reorderCanvasLayer(current, id, direction));
  }

  async function exportWorksheet(format: "png" | "svg" | "pdf") {
    try { setExporting(format); await downloadWorksheet(canvas, title, format); toast.success(`Your ${format.toUpperCase()} export is downloading.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Export could not be completed."); }
    finally { setExporting(null); }
  }

  function uploadAsset(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select a PNG, JPEG, SVG, or other image file."); return; }
    const reader = new FileReader();
    reader.onload = () => saveAsset.mutate({ kind: "upload", name: file.name.replace(/\.[^.]+$/, ""), dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  if (loading) return <div className="studio-loading"><Loader2 className="animate-spin" /> Preparing your studio…</div>;
  if (!user) return <Welcome onLogin={() => startLogin()} />;

  return <div className="studio-shell">
    <aside className="studio-sidebar">
      <div className="brand"><div className="brand-mark"><Palette size={18}/></div><span>Paperloom</span></div>
      <div className="workspace-switcher"><span className="workspace-avatar">{user.name?.slice(0, 1).toUpperCase() || "P"}</span><div><strong>{user.name?.split(" ")[0] || "Personal"}</strong><small>Creative workspace</small></div><ChevronRight size={16}/></div>
      <nav className="side-nav">
        <button className="side-nav-item is-active"><Grid2X2 size={18}/><span>Studio</span></button>
        <button className="side-nav-item" onClick={() => setProjectsOpen(true)}><FolderOpen size={18}/><span>Projects</span><em>{projects.length}</em></button>
        <button className="side-nav-item" onClick={() => setRightPane("assets")}><Archive size={18}/><span>Asset library</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="side-nav-item" onClick={() => setPenSetupOpen(true)}><CircleHelp size={18}/><span>Pen display setup</span></button><button className="side-nav-item" onClick={logout}><LogOut size={18}/><span>Sign out</span></button></div>
    </aside>

    <main className="studio-main">
      <header className="topbar">
        <div className="crumb"><button onClick={() => setProjectsOpen(true)}>My worksheets</button><ChevronRight size={15}/><Input value={title} onChange={(event) => setTitle(event.target.value)} className="title-input" aria-label="Worksheet title" /></div>
        <div className="topbar-actions"><span className={`save-note ${isDirty ? "is-dirty" : ""}`}>{updateProject.isPending || createProject.isPending ? <Loader2 size={14} className="animate-spin"/> : <span className="save-dot"/>}{projectId ? (isDirty ? "Unsaved changes" : "Saved workspace") : (isDirty ? "Unsaved draft" : "New draft")}</span><Button variant="outline" className="top-button" onClick={startFresh}><FilePlus2 size={16}/>New</Button><Button className="save-button" onClick={saveProject} disabled={createProject.isPending || updateProject.isPending || !canSave}>Save</Button></div>
      </header>
      {workspaceError ? <div className="workspace-error" role="alert"><span>We could not refresh part of your workspace. Your current canvas is still open.</span><button onClick={() => { refetchProjects(); refetchAssets(); }}>Try again</button></div> : null}

      <section className="editor-toolbar">
        <div className="tool-group"><ToolButton active={tool === "select"} label="Select and move" onClick={() => setTool("select")}><MousePointer2 size={17}/></ToolButton><ToolButton active={tool === "brush"} label="Freehand brush" onClick={() => setTool("brush")}><Brush size={17}/></ToolButton><ToolButton active={tool === "eraser"} label="Transparent eraser" onClick={() => setTool("eraser")}><Eraser size={17}/></ToolButton></div>
        <div className="toolbar-divider"/>
        <div className="tool-group shape-tools"><ToolButton label="Add rectangle" onClick={() => addDrawingElement("rectangle")}><Square size={16}/></ToolButton><ToolButton label="Add ellipse" onClick={() => addDrawingElement("ellipse")}><Circle className="ellipse-icon" size={16}/></ToolButton><ToolButton label="Add triangle" onClick={() => addDrawingElement("triangle")}><Triangle size={16}/></ToolButton><ToolButton label="Add diamond" onClick={() => addDrawingElement("diamond")}><Diamond size={16}/></ToolButton><ToolButton label="Add star" onClick={() => addDrawingElement("star")}><Star size={16}/></ToolButton><ToolButton label="Add line" onClick={() => addDrawingElement("line")}><Minus size={17}/></ToolButton><ToolButton label="Add arrow" onClick={() => addDrawingElement("arrow")}><ArrowRight size={17}/></ToolButton><ToolButton label="Add text" onClick={() => addDrawingElement("text")}><Type size={17}/></ToolButton><ToolButton active={tool === "bucket"} label="Bucket fill selected shape" onClick={() => addDrawingElement("bucket")}><PaintBucket size={16}/></ToolButton><ToolButton active={tool === "eyedropper"} label="Eyedropper: sample a canvas color" onClick={() => addDrawingElement("eyedropper")}><Pipette size={16}/></ToolButton></div>
        <div className="toolbar-divider"/>
        <div className="tool-group brush-controls"><label className="color-swatch" style={{ background: brushColor }}><input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label="Brush color" /></label><div className="stroke-control"><span>Stroke</span><Slider value={[brushSize]} onValueChange={(value) => setBrushSize(value[0] ?? 12)} min={2} max={60} step={1} className="w-20"/><strong>{brushSize}</strong></div><div className="stroke-control pressure-control"><span>Pressure</span><Slider value={[pressureSensitivity]} onValueChange={(value) => setPressureSensitivity(value[0] ?? 1)} min={0.45} max={1.45} step={0.05} className="w-20"/><strong>{pressureSensitivity < 0.75 ? "Soft" : pressureSensitivity > 1.2 ? "Bold" : "Balanced"}</strong></div></div>
        <div className="toolbar-spacer"/>
        <button className="outline-action" onClick={() => setCanvas((current) => ({ ...current, transparentBackground: !current.transparentBackground }))}><span className={`transparency-icon ${canvas.transparentBackground ? "is-on" : ""}`}/>{canvas.transparentBackground ? "Transparent" : "White background"}</button>
        <button className={`pen-display-button ${penDetected ? "is-detected" : ""}`} onClick={() => setPenSetupOpen(true)}><PenLine size={15}/>{penDetected ? "Pen detected" : "Pen display"}</button>
        <Button className="generate-button" onClick={() => setClipartOpen(true)}><Sparkles size={16}/>Custom clipart</Button>
      </section>

      <section className="editor-workspace">
        <div className="canvas-column">
          <div className="canvas-frame"><div className="canvas-ruler top-ruler"/><div className="canvas-ruler side-ruler"/><div className="canvas-history-controls" role="group" aria-label="Canvas history"><Tooltip><TooltipTrigger asChild><button onClick={undoCanvas} disabled={!historyAvailability.canUndo} aria-label="Undo last canvas edit"><Undo2 size={16}/></button></TooltipTrigger><TooltipContent>Undo canvas edit</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><button onClick={redoCanvas} disabled={!historyAvailability.canRedo} aria-label="Redo canvas edit"><Redo2 size={16}/></button></TooltipTrigger><TooltipContent>Redo canvas edit</TooltipContent></Tooltip></div><WorksheetCanvas state={canvas} onChange={setCanvas} selectedId={selectedId} onSelect={setSelectedId} tool={tool} brushColor={brushColor} brushSize={brushSize} pressureSensitivity={pressureSensitivity} onPenDetected={() => setPenDetected(true)} onEditStart={checkpointCanvas} onPickColor={(color) => { setBrushColor(color); toast.success("Sampled color is now your brush color."); }}/></div>
          <div className="canvas-footer"><span>Letter · 8.5 × 11 in</span><span>{canvas.transparentBackground ? "Transparent canvas" : "White canvas"}</span><span>{canvas.layers.length} {canvas.layers.length === 1 ? "element" : "elements"}</span></div>
        </div>

        <aside className="inspector">
          <Tabs value={rightPane} onValueChange={(value) => setRightPane(value as typeof rightPane)}>
            <TabsList className="inspector-tabs"><TabsTrigger value="properties">Properties</TabsTrigger><TabsTrigger value="layers">Layers</TabsTrigger><TabsTrigger value="assets">Library</TabsTrigger></TabsList>
          </Tabs>
          {rightPane === "properties" && <PropertiesPanel selected={selectedLayer} onChange={updateSelected} onRemove={removeSelected} onDuplicate={duplicateSelected} onForward={() => selectedId && moveLayer(selectedId, "forward")} onBack={() => selectedId && moveLayer(selectedId, "back")} />}
          {rightPane === "layers" && <LayersPanel layers={canvas.layers} selectedId={selectedId} onSelect={setSelectedId} onForward={moveLayer} onBack={moveLayer} />}
          {rightPane === "assets" && <AssetLibrary assets={assets} loading={assetsLoading} onAdd={addAssetToCanvas} onUpload={() => fileRef.current?.click()} onGenerate={() => setGeneratorOpen(true)} onRemove={(assetId) => deleteAsset.mutate({ assetId })}/>} 
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={uploadAsset}/>
        </aside>
      </section>

      <footer className="export-bar"><div className="export-copy"><ArrowDownToLine size={18}/><div><strong>Ready to share</strong><span>Export your worksheet in a classroom-ready format.</span></div></div><div className="export-actions"><Button variant="outline" onClick={() => exportWorksheet("svg")} disabled={Boolean(exporting)}>{exporting === "svg" ? <Loader2 className="animate-spin"/> : null}SVG</Button><Button variant="outline" onClick={() => exportWorksheet("png")} disabled={Boolean(exporting)}>{exporting === "png" ? <Loader2 className="animate-spin"/> : null}PNG</Button><Button onClick={() => exportWorksheet("pdf")} disabled={Boolean(exporting)}>{exporting === "pdf" ? <Loader2 className="animate-spin"/> : null}Export PDF</Button></div></footer>
    </main>
    <ProjectDialog open={projectsOpen} projects={projects} activeId={projectId} onOpenChange={setProjectsOpen} onCreate={startFresh} onOpen={openProject} onRemove={(id) => { removeProject.mutate({ projectId: id }); if (id === projectId) startFresh(); }} />
    <GenerateDialog open={generatorOpen} onOpenChange={setGeneratorOpen} loading={generateAsset.isPending} onGenerate={(input) => { generateAsset.mutate(input); setGeneratorOpen(false); }}/>
    <QuickClipartDialog open={clipartOpen} onOpenChange={setClipartOpen} loading={generateAsset.isPending} onGenerate={(prompt) => { try { const cleanPrompt = prepareCustomClipartPrompt(prompt); generateAsset.mutate({ kind: "clipart", name: cleanPrompt, prompt: cleanPrompt, style: "Clean hand-drawn worksheet clipart" }); setClipartOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Describe the clipart first."); } }}/>
    <PenDisplayDialog open={penSetupOpen} onOpenChange={setPenSetupOpen} detected={penDetected}/>
  </div>;
}

function Welcome({ onLogin }: { onLogin: () => void }) { return <div className="welcome-shell"><div className="welcome-art"><div className="floating-card card-one"><Sparkles size={18}/></div><div className="floating-card card-two"><Palette size={20}/></div><div className="paper-preview"><span className="preview-sun"/><span className="preview-line long"/><span className="preview-line"/><span className="preview-line short"/><span className="preview-sticker">A+</span></div></div><div className="welcome-copy"><div className="eyebrow"><Sparkles size={14}/>AI worksheet studio</div><h1>Make every worksheet<br/><i>feel considered.</i></h1><p>Generate original clipart, paint directly on a layered canvas, and keep every element ready for the next brilliant lesson.</p><Button size="lg" onClick={onLogin}>Enter your studio <ChevronRight size={17}/></Button><small>Your projects and asset history stay private to your workspace.</small></div></div>; }

export function QuickClipartDialog({ open, onOpenChange, loading, onGenerate }: { open: boolean; onOpenChange: (value: boolean) => void; loading: boolean; onGenerate: (prompt: string) => void }) { const [prompt, setPrompt] = useState(""); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="generate-dialog quick-clipart-dialog"><DialogHeader><div className="generator-icon"><Sparkles size={19}/></div><DialogTitle>Create custom clipart</DialogTitle><p>Describe one original worksheet element. Paperloom will create it with a transparent background, add it to this canvas, and save it in your library.</p></DialogHeader><div className="preset-field"><Label>Start with a subject</Label><div className="preset-chips">{clipartSubjectPresets.map((preset) => <button key={preset.subject} type="button" onClick={() => setPrompt(preset.prompt)}>{preset.subject}</button>)}</div></div><div className="generate-field"><Label htmlFor="quick-clipart-prompt">Describe your clipart</Label><Input id="quick-clipart-prompt" autoFocus placeholder="e.g. a cheerful owl holding a pencil" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onGenerate(prompt); }} /></div><div className="transparent-note"><span className="transparency-icon is-on"/><span><strong>Direct-to-canvas</strong> Transparent clipart will be selected on your worksheet when it is ready.</span></div><Button className="generate-submit" disabled={loading || prompt.trim().length < 3} onClick={() => onGenerate(prompt)}>{loading ? <Loader2 className="animate-spin"/> : <WandSparkles size={16}/>}Generate & insert clipart</Button></DialogContent></Dialog>; }

function PropertiesPanel({ selected, onChange, onRemove, onDuplicate, onForward, onBack }: { selected: StudioLayer | null; onChange: (patch: Partial<StudioLayer>) => void; onRemove: () => void; onDuplicate: () => void; onForward: () => void; onBack: () => void }) {
  if (!selected) return <div className="empty-inspector"><div className="empty-orb"><MousePointer2 size={22}/></div><h3>Select an element</h3><p>Choose an asset or drawing on your worksheet to adjust its scale, position, and appearance.</p></div>;
  const visualType = layerKindLabel(selected);
  return <div className="property-panel"><div className="selection-heading"><div className="layer-thumbnail">{selected.type === "image" ? <img src={selected.src} alt=""/> : selected.type === "text" ? <Type size={18}/> : selected.type === "shape" ? <Square size={18}/> : <Brush size={18}/>}</div><div><strong>{selected.name}</strong><span>{visualType}</span></div><button onClick={onRemove} className="icon-danger" aria-label="Delete element"><Trash2 size={16}/></button></div><div className="property-section"><label>Opacity <strong>{Math.round(selected.opacity * 100)}%</strong></label><Slider value={[selected.opacity * 100]} min={10} max={100} step={1} onValueChange={(value) => onChange({ opacity: (value[0] ?? 100) / 100 })}/></div>{selected.type === "text" ? <><div className="property-section"><label>Text</label><Input value={selected.text} maxLength={120} onChange={(event) => onChange({ text: event.target.value, name: event.target.value || "Text label" })}/></div><div className="property-section"><label>Style</label><div className="style-row"><label className="color-swatch" style={{ background: selected.color }}><input type="color" value={selected.color} onChange={(event) => onChange({ color: event.target.value })}/></label><NumberInput label="Size" value={selected.fontSize} min={12} onChange={(fontSize) => onChange({ fontSize, height: Math.max(34, fontSize * 1.35) })}/><button className={`format-toggle ${selected.fontWeight === "bold" ? "is-active" : ""}`} onClick={() => onChange({ fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}>B</button></div></div></> : selected.type === "shape" ? <><div className="property-section"><label>{selected.shape === "line" || selected.shape === "arrow" ? "Stroke" : "Fill & stroke"}</label><div className="style-row"><label className="color-swatch" style={{ background: selected.stroke }}><input type="color" value={selected.stroke} onChange={(event) => onChange({ stroke: event.target.value })}/></label>{selected.fill !== "none" ? <label className="color-swatch" style={{ background: selected.fill }}><input type="color" value={selected.fill} onChange={(event) => onChange({ fill: event.target.value })}/></label> : null}<NumberInput label="Width" value={selected.strokeWidth} min={1} onChange={(strokeWidth) => onChange({ strokeWidth })}/></div></div>{selected.fill !== "none" ? <div className="property-section"><label>Fill opacity <strong>{Math.round(selected.fillOpacity * 100)}%</strong></label><Slider value={[selected.fillOpacity * 100]} min={0} max={100} step={1} onValueChange={(value) => onChange({ fillOpacity: (value[0] ?? 0) / 100 })}/></div> : null}</> : selected.type === "image" ? <><div className="property-section"><label>Position</label><div className="dual-input"><NumberInput label="X" value={selected.x} onChange={(x) => onChange({ x })}/><NumberInput label="Y" value={selected.y} onChange={(y) => onChange({ y })}/></div></div><div className="property-section"><label>Dimensions</label><div className="dual-input"><NumberInput label="W" value={selected.width} min={40} onChange={(width) => onChange({ width })}/><NumberInput label="H" value={selected.height} min={40} onChange={(height) => onChange({ height })}/></div></div></> : <div className="property-section"><label>Stroke</label><div className="path-style"><span className="brush-dot" style={{ background: selected.mode === "erase" ? "#d1d1d1" : selected.color, width: Math.min(selected.strokeWidth, 28), height: Math.min(selected.strokeWidth, 28) }}/><span>{selected.strokeWidth}px {selected.mode === "erase" ? "eraser" : "brush"}</span></div></div>} {selected.type !== "path" ? <div className="property-section"><label>Position</label><div className="dual-input"><NumberInput label="X" value={selected.x} onChange={(x) => onChange({ x })}/><NumberInput label="Y" value={selected.y} onChange={(y) => onChange({ y })}/></div></div> : null}{selected.type !== "path" ? <div className="property-section"><label>Rotation</label><div className="rotation-control"><RotateCcw size={15}/><Slider value={[selected.rotation]} min={-180} max={180} step={1} onValueChange={(value) => onChange({ rotation: value[0] ?? 0 })}/><strong>{selected.rotation}°</strong></div></div> : null}<div className="arrange-row arrange-row--three"><button onClick={onBack}>Back</button><button onClick={onDuplicate}><Copy size={13}/>Duplicate</button><button onClick={onForward}>Forward</button></div></div>;
}

function NumberInput({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) { return <label className="number-field"><span>{label}</span><input type="number" min={min} value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value) || 0)}/></label>; }

function LayersPanel({ layers, selectedId, onSelect, onForward, onBack }: { layers: StudioLayer[]; selectedId: string | null; onSelect: (id: string) => void; onForward: (id: string, direction: "forward" | "back") => void; onBack: (id: string, direction: "forward" | "back") => void }) { if (!layers.length) return <div className="empty-inspector"><div className="empty-orb"><Layers3 size={22}/></div><h3>No elements yet</h3><p>Create an AI asset, upload a favorite, add a shape, or take up the brush to begin your composition.</p></div>; return <div className="layer-list">{[...layers].reverse().map((layer) => <div key={layer.id} className={`layer-row ${layer.id === selectedId ? "is-active" : ""}`} onClick={() => onSelect(layer.id)}><div className="layer-thumb">{layer.type === "image" ? <img src={layer.src} alt=""/> : layer.type === "text" ? <Type size={15}/> : layer.type === "shape" ? <Square size={15}/> : <Brush size={15}/>}</div><div><strong>{layer.name}</strong><span>{layerKindLabel(layer)}</span></div><button aria-label="Bring layer forward" onClick={(event) => { event.stopPropagation(); onForward(layer.id, "forward"); }}><MoreHorizontal size={16}/></button></div>)}</div>; }

function AssetLibrary({ assets, loading, onAdd, onUpload, onGenerate, onRemove }: { assets: Array<{ id: number; name: string; url: string; kind: string; prompt?: string | null }>; loading: boolean; onAdd: (asset: { id: number; name: string; url: string; kind: string }) => void; onUpload: () => void; onGenerate: () => void; onRemove: (id: number) => void }) { return <div className="asset-library"><div className="library-header"><div><strong>Your asset history</strong><span>Reusable across every worksheet.</span></div><button onClick={onUpload} aria-label="Upload image"><Upload size={17}/></button></div><div className="library-actions"><button onClick={onGenerate}><WandSparkles size={15}/>Generate</button><button onClick={onUpload}><ImagePlus size={15}/>Upload</button></div>{loading ? <div className="library-empty"><Loader2 className="animate-spin"/></div> : !assets.length ? <div className="library-empty"><div className="empty-orb"><Archive size={20}/></div><h3>Your library is ready</h3><p>Generated and uploaded elements will stay here for every future project.</p><Button onClick={onGenerate}><Sparkles size={15}/>Create your first asset</Button></div> : <div className="asset-grid">{assets.map((asset) => <div className="asset-card" key={asset.id}><button className="asset-preview" onClick={() => onAdd(asset)}><img src={asset.url} alt={asset.name}/><span>{kindNames[asset.kind as AssetKind] ?? "Asset"}</span></button><div><strong title={asset.name}>{asset.name}</strong><button onClick={() => onRemove(asset.id)} aria-label={`Remove ${asset.name}`}><Trash2 size={14}/></button></div></div>)}</div>}</div>; }

function ProjectDialog({ open, onOpenChange, projects, activeId, onCreate, onOpen, onRemove }: { open: boolean; onOpenChange: (value: boolean) => void; projects: Array<{ id: number; title: string; updatedAt: Date | string }>; activeId: number | null; onCreate: () => void; onOpen: (project: { id: number; title: string; canvasData: string }) => void; onRemove: (id: number) => void }) { const utils = trpc.useUtils(); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="project-dialog"><DialogHeader><DialogTitle>My worksheets</DialogTitle></DialogHeader><Button className="new-project-dialog" onClick={onCreate}><Plus size={16}/>Start a blank worksheet</Button><div className="project-list">{projects.length ? projects.map((project) => <div key={project.id} className={`project-item ${activeId === project.id ? "is-active" : ""}`}><button onClick={async () => { try { const data = await utils.project.get.fetch({ projectId: project.id }); if (data) onOpen(data); } catch (error) { toast.error(error instanceof Error ? error.message : "Worksheet could not be opened. Please try again."); } }}><div className="project-thumb"><span/><span/><span/></div><div><strong>{project.title}</strong><small>Edited {new Date(project.updatedAt).toLocaleDateString()}</small></div></button><button className="project-trash" onClick={() => onRemove(project.id)} aria-label={`Delete ${project.title}`}><Trash2 size={15}/></button></div>) : <div className="projects-empty">No saved worksheets yet. Your first save will appear here.</div>}</div></DialogContent></Dialog>; }

function GenerateDialog({ open, onOpenChange, loading, onGenerate }: { open: boolean; onOpenChange: (value: boolean) => void; loading: boolean; onGenerate: (input: { kind: "clipart" | "border" | "header"; name: string; prompt: string; style?: string }) => void }) { const [kind, setKind] = useState<"clipart" | "border" | "header">("clipart"); const [prompt, setPrompt] = useState(""); const [style, setStyle] = useState("Warm hand-drawn vector"); const title = prompt.trim() || `New ${kind}`; return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="generate-dialog"><DialogHeader><div className="generator-icon"><Sparkles size={19}/></div><DialogTitle>Create a worksheet asset</DialogTitle><p>Describe an original element. Every generation is guided to use a true transparent background.</p></DialogHeader><Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)}><TabsList className="kind-tabs"><TabsTrigger value="clipart">Clipart</TabsTrigger><TabsTrigger value="border">Border</TabsTrigger><TabsTrigger value="header">Header</TabsTrigger></TabsList></Tabs><div className="generate-field"><Label htmlFor="asset-prompt">What would you like to make?</Label><textarea id="asset-prompt" placeholder={kind === "border" ? "e.g. playful autumn leaves around the edges" : kind === "header" ? "e.g. friendly forest animals holding school supplies" : "e.g. a cheerful fox reading a book"} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div><div className="generate-field"><Label htmlFor="asset-style">Illustration style</Label><Input id="asset-style" value={style} onChange={(event) => setStyle(event.target.value)} /></div><div className="transparent-note"><span className="transparency-icon is-on"/><span><strong>Transparent-ready</strong> No background, shadow, or stray edges.</span></div><Button className="generate-submit" disabled={loading || prompt.trim().length < 3} onClick={() => onGenerate({ kind, name: title, prompt, style })}>{loading ? <Loader2 className="animate-spin"/> : <WandSparkles size={16}/>}Generate {kind}</Button></DialogContent></Dialog>; }

function PenDisplayDialog({ open, onOpenChange, detected }: { open: boolean; onOpenChange: (value: boolean) => void; detected: boolean }) { const [checked, setChecked] = useState<string[]>([]); const toggleCheck = (target: string) => setChecked((current) => current.includes(target) ? current.filter((item) => item !== target) : [...current, target]); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="pen-setup-dialog"><DialogHeader><div className="generator-icon pen-icon"><PenLine size={19}/></div><DialogTitle>VEIKK VK1200 V2 setup</DialogTitle><p>Paperloom works with the browser’s pen input. It uses stylus pressure, supports the pen eraser, and ignores palm/touch input while your stylus is actively drawing.</p></DialogHeader><div className="pen-status"><span className={detected ? "status-dot ready" : "status-dot"}/><strong>{detected ? "Pen input detected in Paperloom" : "Waiting for a pen stroke"}</strong></div><ol className="pen-steps"><li><span>1</span><div><strong>Install or update the VEIKK driver</strong><p>Choose the VK1200 V2 and map it to this display in the VEIKK driver. Browser apps cannot change device mapping directly.</p></div></li><li><span>2</span><div><strong>Choose the Brush, then draw</strong><p>Stroke weight responds to pressure. Flip or map the P05 pen’s eraser to erase transparently.</p></div></li><li><span>3</span><div><strong>Check display alignment</strong><p>Tap each target with the stylus. If the dot does not sit beneath your pen tip, recalibrate the display mapping in the VEIKK driver.</p></div></li></ol><div className="calibration-pad" aria-label="Pen alignment check">{["top-left", "top-right", "center", "bottom-left", "bottom-right"].map((target) => <button key={target} className={`${target} ${checked.includes(target) ? "is-checked" : ""}`} onPointerDown={() => toggleCheck(target)} aria-label={`Test ${target.replace("-", " ")} alignment`}><span/></button>)}</div><a className="driver-link" href="https://veikk.com/pages/download" target="_blank" rel="noreferrer">Open VEIKK driver downloads <ChevronRight size={15}/></a></DialogContent></Dialog>; }
