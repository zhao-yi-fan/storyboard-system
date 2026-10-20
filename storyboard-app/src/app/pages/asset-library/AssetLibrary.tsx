import { ArrowLeft, Film } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";

import {
  type Asset,
  assetApi,
  type AssetRequirement,
  type AssetVersion,
  assetWorkspaceApi,
  type Character,
  characterApi,
  type Project,
  projectApi,
} from "../../api";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  ASSET_LIBRARY_TAB,
  ASSET_VIEW_MODE,
  type AssetLibraryTab,
  type AssetViewMode,
  ENTITY_TYPE,
} from "../../constants/domain";
import {
  getProjectPosition,
  projectAssetsPath,
  rememberProjectPosition,
} from "../../lib/projectPosition";
import { mediaIdentity } from "../../lib/signedMedia";
import { AssetDetailSidebar } from "./AssetDetailSidebar";
import type { SelectedAsset } from "./AssetLibrary.helpers";
import styles from "./AssetLibrary.module.scss";
import { AssetLibraryDialogs } from "./AssetLibraryDialogs";
import { AssetPreparation } from "./AssetPreparation";
import { AssetViewNavigation } from "./AssetViewNavigation";
import { PersonalImportDialog } from "./PersonalImportDialog";
import { ProjectAssetCollection } from "./ProjectAssetCollection";
import { useAssetCreate } from "./useAssetCreate";
import { useAssetDeletion } from "./useAssetDeletion";
import { useAssetDraftGuard } from "./useAssetDraftGuard";
import { useAssetEditing } from "./useAssetEditing";
import { useAssetLibraryFilters } from "./useAssetLibraryFilters";
import { useResizableDetailSidebar } from "./useAssetLibrarySidebar";
import { useAssetPreparation } from "./useAssetPreparation";
import { useAssetVersions } from "./useAssetVersions";

function ProjectAssetPage({ currentProjectId }: { currentProjectId: number }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chapterParam = searchParams.get("chapter");
  const prepare = searchParams.get("view") === "prepare";
  const kind =
    searchParams.get("kind") === "scene"
      ? "scene"
      : searchParams.get("kind") === "prop"
        ? "prop"
        : "character";
  const requestedEntity =
    searchParams.get("entity") ??
    (searchParams.get("character") ? `character:${searchParams.get("character")}` : "");
  const preparation = useAssetPreparation(currentProjectId, chapterParam, prepare);
  const refreshRequirements = preparation.refresh;
  const [showImport, setShowImport] = useState(false);
  const [importTarget, setImportTarget] = useState<AssetRequirement | undefined>();
  const [versionToAdopt, setVersionToAdopt] = useState<AssetVersion | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const activeTab: AssetLibraryTab =
    kind === "scene"
      ? ASSET_LIBRARY_TAB.SCENES
      : kind === "prop"
        ? ASSET_LIBRARY_TAB.PROPS
        : ASSET_LIBRARY_TAB.CHARACTERS;
  const setActiveTab = (tab: AssetLibraryTab) =>
    updateQuery({
      kind:
        tab === ASSET_LIBRARY_TAB.SCENES
          ? "scene"
          : tab === ASSET_LIBRARY_TAB.PROPS
            ? "prop"
            : "character",
    });
  const {
    selectedAsset,
    setSelectedAsset,
    updateSelectedAsset,
    setDraft,
    requestAction,
    dirty,
    dialog: draftDialog,
  } = useAssetDraftGuard(() =>
    selectedAsset?.type === ENTITY_TYPE.CHARACTER ? saveSelectedCharacter() : saveSelectedAsset(),
  );
  const [viewMode, setViewMode] = useState<AssetViewMode>(ASSET_VIEW_MODE.GRID);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const { detailSidebarWidth, isResizingDetailSidebar, resizeHandleProps } =
    useResizableDetailSidebar(Boolean(selectedAsset));
  const selectedCharacterReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const handledEntity = useRef<string | null>(null);
  const openSequence = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const selectedCharacterVoiceReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAssetFileInputRef = useRef<HTMLInputElement | null>(null);
  const updateQuery = (changes: Record<string, string | null>) => {
    openSequence.current++;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        next.delete("character");
        return next;
      },
      { replace: true },
    );
  };
  const selectAsset = (asset: SelectedAsset) =>
    requestAction(() => {
      setSelectedAsset(asset);
      updateQuery({ entity: asset ? `${asset.type}:${asset.data.id}` : null });
      setShowActionMenu(false);
    });
  const openRequirement = async (item: AssetRequirement) => {
    const sequence = ++openSequence.current;
    if (!item.linked_entity_id || !item.linked_entity_type) {
      setLoadError("关联资产暂不可用，请刷新后重试");
      return;
    }
    try {
      const data =
        item.linked_entity_type === ENTITY_TYPE.CHARACTER
          ? await characterApi.getCharacter(item.linked_entity_id)
          : await assetApi.getAsset(item.linked_entity_id);
      if (!mounted.current || sequence !== openSequence.current) return;
      selectAsset({ type: item.linked_entity_type, data } as SelectedAsset);
    } catch (reason) {
      if (mounted.current && sequence === openSequence.current)
        setLoadError(reason instanceof Error ? reason.message : "资产加载失败");
    }
  };

  const {
    filteredCharacters,
    filteredSceneAssets,
    filteredPropAssets,
    sceneAssetCount,
    propAssetCount,
  } = useAssetLibraryFilters(characters, assets, searchQuery);
  const selectedAssetType = selectedAsset?.type;
  const selectedAssetId = selectedAsset?.data.id;

  const loadCharacters = useCallback(async () => {
    try {
      if (!currentProjectId) {
        setCharacters([]);
        return;
      }
      const data = await characterApi.getCharactersByProject(currentProjectId);
      setCharacters(data ?? []);
    } catch (error) {
      console.error("Failed to load characters:", error);
    }
  }, [currentProjectId]);

  const loadAssets = useCallback(async () => {
    try {
      if (!currentProjectId) {
        setAssets([]);
        return;
      }
      const data = await assetApi.getAssetsByProject(currentProjectId);
      setAssets(data ?? []);
    } catch (error) {
      console.error("Failed to load assets:", error);
    }
  }, [currentProjectId]);

  const {
    showCreateDialog,
    setShowCreateDialog,
    createMode,
    newCharacter,
    setNewCharacter,
    newAsset,
    setNewAsset,
    createCharacterFile,
    setCreateCharacterFile,
    createAssetFile,
    setCreateAssetFile,
    isCreating,
    resetCreateState,
    handleCreate,
    openCreateDialog,
    selectCreateMode,
  } = useAssetCreate({
    currentProjectId,
    activeTab,
    loadCharacters,
    loadAssets,
    setActiveTab,
    setSelectedAsset: (asset) => {
      setSelectedAsset(asset);
      updateQuery({
        entity: asset ? `${asset.type}:${asset.data.id}` : null,
        kind:
          asset?.type === ENTITY_TYPE.ASSET
            ? asset.data.type === "prop"
              ? "prop"
              : "scene"
            : "character",
      });
    },
  });

  const {
    versions,
    setVersions,
    isLoadingVersions,
    setIsLoadingVersions,
    switchingVersionId,
    showVersions,
    setShowVersions,
    voiceVersions,
    showVoiceVersions,
    setShowVoiceVersions,
    isSavingPersonal,
    openSelectedVersions,
    chooseSelectedVersion,
    saveSelectedToPersonal,
    openVoiceVersions,
    chooseVoiceVersion,
  } = useAssetVersions({
    selectedAsset,
    setSelectedAsset: updateSelectedAsset,
    setCharacters,
    loadCharacters,
    loadAssets,
    setLoadError,
  });

  const { deleteTarget, setDeleteTarget, deleteActionKey, confirmDelete } = useAssetDeletion({
    selectedAsset,
    setSelectedAsset: (asset) => {
      setSelectedAsset(asset);
      if (!asset) updateQuery({ entity: null });
    },
    loadCharacters,
    loadAssets,
  });

  useEffect(() => {
    let cancelled = false;
    const loadLibraryData = async () => {
      setLoading(true);
      setProject(null);
      setSelectedAsset(null);
      handledEntity.current = null;
      setLoadError("");
      try {
        if (!currentProjectId) {
          void navigate("/projects", { replace: true });
          return;
        }
        const [projectData, characterData, assetData] = await Promise.all([
          projectApi.getProject(currentProjectId),
          characterApi.getCharactersByProject(currentProjectId),
          assetApi.getAssetsByProject(currentProjectId),
        ]);
        if (!cancelled) {
          setProject(projectData);
          setCharacters(characterData ?? []);
          setAssets(assetData ?? []);
        }
      } catch (error) {
        console.error("Failed to load asset library data:", error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "资产库加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLibraryData();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, navigate, setSelectedAsset]);

  useEffect(() => {
    if (
      loading ||
      !project ||
      project.id !== currentProjectId ||
      handledEntity.current === requestedEntity
    )
      return;
    if (!requestedEntity) {
      handledEntity.current = "";
      setSelectedAsset(null);
      return;
    }
    const [type, rawId] = requestedEntity.split(":");
    const id = Number(rawId);
    if (selectedAsset?.type === type && selectedAsset.data.id === id) {
      handledEntity.current = requestedEntity;
      return;
    }
    const entity =
      type === ENTITY_TYPE.CHARACTER
        ? characters.find((item) => item.id === id)
        : type === ENTITY_TYPE.ASSET
          ? assets.find((item) => item.id === id)
          : undefined;
    if (entity) {
      handledEntity.current = requestedEntity;
      setSelectedAsset({ type, data: entity } as SelectedAsset);
    }
  }, [
    requestedEntity,
    characters,
    assets,
    project,
    currentProjectId,
    loading,
    selectedAsset,
    setSelectedAsset,
  ]);

  useEffect(() => {
    if (!project || project.id !== currentProjectId || loading || !preparation.chaptersLoaded)
      return;
    const params = new URLSearchParams({
      view: prepare ? "prepare" : "all",
      kind,
    });
    if (prepare)
      params.set("chapter", preparation.chapterId ? String(preparation.chapterId) : "all");
    else if (
      chapterParam === "all" ||
      preparation.chapters.some((chapter) => chapter.id === Number(chapterParam))
    )
      params.set("chapter", chapterParam ?? "all");
    if (searchQuery) params.set("q", searchQuery);
    if (selectedAsset) params.set("entity", `${selectedAsset.type}:${selectedAsset.data.id}`);
    rememberProjectPosition(currentProjectId, projectAssetsPath(currentProjectId, params));
  }, [
    currentProjectId,
    prepare,
    kind,
    project,
    loading,
    preparation.chaptersLoaded,
    preparation.chapterId,
    preparation.chapters,
    chapterParam,
    searchQuery,
    selectedAsset,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedAssetType || !selectedAssetId) {
      setVersions([]);
      return;
    }
    setIsLoadingVersions(true);
    void assetWorkspaceApi
      .getVersions(selectedAssetType, selectedAssetId)
      .then((items) => {
        if (!cancelled) setVersions(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setVersions([]);
          console.error("Failed to load asset versions:", error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVersions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, selectedAssetType, setIsLoadingVersions, setVersions]);

  const {
    isSavingCharacter,
    isSavingAsset,
    uploadingCharacterReferenceId,
    uploadingCharacterVoiceReferenceId,
    generatingCharacterDesignSheetId,
    generatingCharacterVoiceReferenceId,
    characterVoiceReferenceError,
    generatingAssetCoverId,
    aiPreviewDialog,
    setAiPreviewDialog,
    isLoadingAIPreview,
    saveSelectedCharacter,
    saveSelectedAsset,
    handleGenerateCharacterDesignSheet,
    handleUploadSelectedCharacterReference,
    handleUploadSelectedCharacterVoiceReference,
    handleUploadSelectedAssetFile,
    handleGenerateCharacterVoiceReference,
    handleGenerateAssetCover,
    confirmAIPreviewGeneration,
  } = useAssetEditing({
    selectedAsset,
    setSelectedAsset: updateSelectedAsset,
    setCharacters,
    setAssets,
    setActiveTab,
    setVersions,
    selectedCharacterReferenceInputRef,
    selectedCharacterVoiceReferenceInputRef,
    selectedAssetFileInputRef,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCharacters(), loadAssets(), refreshRequirements()]);
    if (selectedAsset && !dirty) {
      const updated =
        selectedAsset.type === ENTITY_TYPE.CHARACTER
          ? await characterApi.getCharacter(selectedAsset.data.id)
          : await assetApi.getAsset(selectedAsset.data.id);
      updateSelectedAsset({ type: selectedAsset.type, data: updated } as SelectedAsset, true);
    }
  }, [loadCharacters, loadAssets, refreshRequirements, selectedAsset, dirty, updateSelectedAsset]);
  const withRefresh = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      const result = await action();
      await preparation.refresh();
      return result;
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "资产操作失败");
      throw reason;
    }
  };
  const selectedRequirement = preparation.requirements.find(
    (item) =>
      item.linked_entity_type === selectedAsset?.type &&
      item.linked_entity_id === selectedAsset?.data.id,
  );

  const taskSignature =
    `${currentProjectId}:${preparation.chapterId ?? "all"}:` +
    preparation.requirements
      .map(
        (item) =>
          `${item.linked_entity_type}:${item.linked_entity_id}:${item.generation_status ?? item.status}:${item.file_url ? mediaIdentity(item.file_url) : "missing"}`,
      )
      .join("|");
  const lastTaskSignature = useRef("");
  useEffect(() => {
    if (lastTaskSignature.current === taskSignature) return;
    const previous = lastTaskSignature.current;
    lastTaskSignature.current = taskSignature;
    if (previous && preparation.requirements.length)
      void refreshAll().catch((reason) =>
        setLoadError(reason instanceof Error ? reason.message : "资产状态刷新失败"),
      );
  }, [taskSignature, preparation.requirements.length, refreshAll]);

  return (
    <div className={`storyboard-product-shell dark ${styles.page}`}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderContent}>
          <div className={styles.pageHeaderStart}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void navigate(
                  currentProjectId
                    ? getProjectPosition(currentProjectId, true) +
                        (preparation.chapterId &&
                        !getProjectPosition(currentProjectId, true).includes("chapter=")
                          ? `&chapter=${preparation.chapterId}`
                          : "")
                    : "/projects",
                )
              }
              className={styles.backButton}
            >
              <ArrowLeft className={styles.backIcon} />
              进入分镜工作台
            </Button>
            <div className={styles.headerDivider}></div>
            <div className={styles.pageBrand}>
              <div className={styles.pageBrandIcon}>
                <Film className={styles.icon} />
              </div>
              <span className={styles.pageBrandTitle}>{project?.name ?? "项目"} · 项目资产</span>
            </div>
          </div>
        </div>
        <AssetViewNavigation
          prepare={prepare}
          chapterId={preparation.chapterId}
          items={preparation.requirements}
          loading={loading || preparation.loading}
          busy={preparation.batchBusy}
          onView={(view) =>
            requestAction(() => {
              setSelectedAsset(null);
              updateQuery({ view, entity: null });
            })
          }
          onImport={() =>
            requestAction(() => {
              setImportTarget(undefined);
              setShowImport(true);
            })
          }
          onCreate={() => requestAction(openCreateDialog)}
          onGenerate={async () => {
            await preparation.generateMissing();
            await refreshAll();
          }}
        />
      </header>

      <div className={styles.pageBody}>
        <main className={styles.assetMain}>
          {loadError ? <div className={styles.loadError}>{loadError}</div> : null}
          {prepare ? (
            <AssetPreparation
              chapters={preparation.chapters}
              chapterId={preparation.chapterId}
              kind={kind}
              items={preparation.requirements}
              loading={loading || preparation.loading}
              error={preparation.error}
              onChapter={(chapter) =>
                requestAction(() => {
                  setSelectedAsset(null);
                  updateQuery({ chapter, entity: null });
                })
              }
              onKind={(nextKind) =>
                requestAction(() => {
                  setSelectedAsset(null);
                  updateQuery({ kind: nextKind, entity: null });
                })
              }
              onOpen={(item) => void openRequirement(item)}
              onRefresh={() => void refreshAll()}
            />
          ) : (
            <ProjectAssetCollection
              onCreate={() => requestAction(openCreateDialog)}
              activeTab={activeTab}
              onTab={(tab) =>
                requestAction(() => {
                  updateQuery({
                    kind:
                      tab === ASSET_LIBRARY_TAB.SCENES
                        ? "scene"
                        : tab === ASSET_LIBRARY_TAB.PROPS
                          ? "prop"
                          : "character",
                    entity: null,
                  });
                  setSelectedAsset(null);
                  setShowActionMenu(false);
                })
              }
              characters={filteredCharacters}
              sceneAssets={filteredSceneAssets}
              propAssets={filteredPropAssets}
              counts={{
                characters: characters.length,
                scenes: sceneAssetCount,
                props: propAssetCount,
              }}
              loading={loading}
              viewMode={viewMode}
              onViewMode={setViewMode}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              selectedAsset={selectedAsset}
              onSelect={selectAsset}
            />
          )}
        </main>
        <AssetDetailSidebar
          selectedAsset={selectedAsset}
          editingBusy={
            isLoadingAIPreview ||
            isSavingCharacter ||
            isSavingAsset ||
            uploadingCharacterReferenceId === selectedAsset?.data.id ||
            uploadingCharacterVoiceReferenceId === selectedAsset?.data.id ||
            generatingCharacterDesignSheetId === selectedAsset?.data.id ||
            generatingCharacterVoiceReferenceId === selectedAsset?.data.id ||
            generatingAssetCoverId === selectedAsset?.data.id
          }
          detailSidebarWidth={detailSidebarWidth}
          isResizingDetailSidebar={isResizingDetailSidebar}
          resizeHandleProps={resizeHandleProps}
          showActionMenu={showActionMenu}
          setShowActionMenu={setShowActionMenu}
          setSelectedAsset={(asset) => (asset ? setDraft(asset) : selectAsset(null))}
          setDeleteTarget={(target) => requestAction(() => setDeleteTarget(target))}
          setPreviewImage={setPreviewImage}
          versions={versions}
          isLoadingVersions={isLoadingVersions}
          switchingVersionId={switchingVersionId}
          openSelectedVersions={() => void openSelectedVersions()}
          chooseSelectedVersion={setVersionToAdopt}
          openVoiceVersions={() => void openVoiceVersions()}
          isSavingPersonal={isSavingPersonal}
          saveSelectedToPersonal={() =>
            requestAction(() => void withRefresh(saveSelectedToPersonal).catch(() => undefined))
          }
          saveSelectedCharacter={() =>
            void withRefresh(saveSelectedCharacter).catch(() => undefined)
          }
          saveSelectedAsset={() => void withRefresh(saveSelectedAsset).catch(() => undefined)}
          isSavingCharacter={isSavingCharacter}
          isSavingAsset={isSavingAsset}
          uploadingCharacterReferenceId={uploadingCharacterReferenceId}
          uploadingCharacterVoiceReferenceId={uploadingCharacterVoiceReferenceId}
          generatingCharacterDesignSheetId={generatingCharacterDesignSheetId}
          generatingCharacterVoiceReferenceId={generatingCharacterVoiceReferenceId}
          generatingAssetCoverId={generatingAssetCoverId}
          characterVoiceReferenceError={characterVoiceReferenceError}
          handleGenerateCharacterDesignSheet={() =>
            void withRefresh(handleGenerateCharacterDesignSheet).catch(() => undefined)
          }
          handleGenerateCharacterVoiceReference={() =>
            void withRefresh(handleGenerateCharacterVoiceReference).catch(() => undefined)
          }
          handleGenerateAssetCover={() =>
            void withRefresh(handleGenerateAssetCover).catch(() => undefined)
          }
          handleUploadSelectedCharacterReference={(file) =>
            withRefresh(() => handleUploadSelectedCharacterReference(file)).catch(() => undefined)
          }
          handleUploadSelectedCharacterVoiceReference={(file) =>
            withRefresh(() => handleUploadSelectedCharacterVoiceReference(file)).catch(
              () => undefined,
            )
          }
          handleUploadSelectedAssetFile={(file) =>
            withRefresh(() => handleUploadSelectedAssetFile(file)).catch(() => undefined)
          }
          selectedCharacterReferenceInputRef={selectedCharacterReferenceInputRef}
          selectedCharacterVoiceReferenceInputRef={selectedCharacterVoiceReferenceInputRef}
          selectedAssetFileInputRef={selectedAssetFileInputRef}
          onImport={
            selectedRequirement
              ? () =>
                  requestAction(() => {
                    setImportTarget(selectedRequirement);
                    setShowImport(true);
                  })
              : undefined
          }
        />
      </div>
      <PersonalImportDialog
        open={showImport}
        kind={importTarget?.kind ?? kind}
        target={importTarget}
        projectId={currentProjectId}
        onClose={() => setShowImport(false)}
        onImported={refreshAll}
      />
      {draftDialog}
      <Dialog
        open={Boolean(versionToAdopt)}
        onOpenChange={(open) => {
          if (!open) setVersionToAdopt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>采用此项目资产版本？</DialogTitle>
          </DialogHeader>
          <p>这是项目共享资产，采用后会影响引用它的各集后续生成。已有图片和视频不会自动替换。</p>
          <Button
            onClick={() => {
              const version = versionToAdopt;
              setVersionToAdopt(null);
              if (version)
                requestAction(
                  () =>
                    void withRefresh(() => chooseSelectedVersion(version)).catch(() => undefined),
                );
            }}
          >
            设为当前
          </Button>
          <Button variant="ghost" onClick={() => setVersionToAdopt(null)}>
            取消
          </Button>
        </DialogContent>
      </Dialog>

      <AssetLibraryDialogs
        aiPreviewDialog={aiPreviewDialog}
        setAiPreviewDialog={setAiPreviewDialog}
        isLoadingAIPreview={isLoadingAIPreview}
        setPreviewImage={setPreviewImage}
        confirmAIPreviewGeneration={async () => {
          await withRefresh(confirmAIPreviewGeneration).catch(() => undefined);
          await refreshAll();
        }}
        showVersions={showVersions}
        setShowVersions={setShowVersions}
        versions={versions}
        selectedAsset={selectedAsset}
        switchingVersionId={switchingVersionId}
        chooseSelectedVersion={setVersionToAdopt}
        showVoiceVersions={showVoiceVersions}
        setShowVoiceVersions={setShowVoiceVersions}
        voiceVersions={voiceVersions}
        chooseVoiceVersion={chooseVoiceVersion}
        showCreateDialog={showCreateDialog}
        setShowCreateDialog={setShowCreateDialog}
        createMode={createMode}
        newCharacter={newCharacter}
        setNewCharacter={setNewCharacter}
        newAsset={newAsset}
        setNewAsset={setNewAsset}
        createCharacterFile={createCharacterFile}
        setCreateCharacterFile={setCreateCharacterFile}
        createAssetFile={createAssetFile}
        setCreateAssetFile={setCreateAssetFile}
        isCreating={isCreating}
        resetCreateState={resetCreateState}
        selectCreateMode={selectCreateMode}
        handleCreate={handleCreate}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteActionKey={deleteActionKey}
        confirmDelete={confirmDelete}
        previewImage={previewImage}
      />
    </div>
  );
}

export default function AssetLibrary() {
  const { projectId } = useParams();
  const id = Number(projectId);
  if (!/^[1-9]\d*$/.test(projectId ?? "") || !Number.isSafeInteger(id))
    return <Navigate to="/projects" replace />;
  return <ProjectAssetPage key={id} currentProjectId={id} />;
}
