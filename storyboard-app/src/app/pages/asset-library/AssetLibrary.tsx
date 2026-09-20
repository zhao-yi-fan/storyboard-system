import {
  ArrowLeft,
  Film,
  Grid3x3,
  List,
  Loader2,
  MapPin,
  Package,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import {
  type Asset,
  assetApi,
  assetWorkspaceApi,
  type Character,
  characterApi,
  type Project,
  projectApi,
} from "../../api";
import { AssetCollection, ContainedAssetImage } from "../../components/assets/AssetCollection";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  ASSET_LIBRARY_TAB,
  ASSET_VIEW_MODE,
  type AssetLibraryTab,
  type AssetViewMode,
  ENTITY_TYPE,
} from "../../constants/domain";
import { AssetDetailSidebar } from "./AssetDetailSidebar";
import type { SelectedAsset } from "./AssetLibrary.helpers";
import { getCharacterPreviewSrc, hasCharacterVoiceReference } from "./AssetLibrary.helpers";
import styles from "./AssetLibrary.module.scss";
import { AssetLibraryDialogs } from "./AssetLibraryDialogs";
import { useAssetCreate } from "./useAssetCreate";
import { useAssetDeletion } from "./useAssetDeletion";
import { useAssetEditing } from "./useAssetEditing";
import { useAssetLibraryFilters } from "./useAssetLibraryFilters";
import { useResizableDetailSidebar } from "./useAssetLibrarySidebar";
import { useAssetVersions } from "./useAssetVersions";

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProjectId = Number(searchParams.get("project") ?? "0");
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<AssetLibraryTab>(ASSET_LIBRARY_TAB.CHARACTERS);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const [viewMode, setViewMode] = useState<AssetViewMode>(ASSET_VIEW_MODE.GRID);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const { detailSidebarWidth, isResizingDetailSidebar, handleDetailSidebarMouseDown } =
    useResizableDetailSidebar();
  const selectedCharacterReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCharacterVoiceReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAssetFileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    filteredCharacters,
    filteredSceneAssets,
    filteredPropAssets,
    sceneAssetCount,
    propAssetCount,
  } = useAssetLibraryFilters(characters, assets, searchQuery);
  const selectedAssetType = selectedAsset?.type;
  const selectedAssetId = selectedAsset?.data.id;

  const loadCharacters = async () => {
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
  };

  const loadAssets = async () => {
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
  };

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
    setSelectedAsset,
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
    setSelectedAsset,
    setCharacters,
    loadCharacters,
    loadAssets,
    setLoadError,
  });

  const { deleteTarget, setDeleteTarget, deleteActionKey, confirmDelete } = useAssetDeletion({
    selectedAsset,
    setSelectedAsset,
    loadCharacters,
    loadAssets,
  });

  useEffect(() => {
    let cancelled = false;
    const loadLibraryData = async () => {
      setLoading(true);
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
          const requestedCharacterId = Number(searchParams.get("character") ?? 0);
          const requestedCharacter = characterData?.find(
            (item) => item.id === requestedCharacterId,
          );
          if (requestedCharacter) {
            setActiveTab(ASSET_LIBRARY_TAB.CHARACTERS);
            setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: requestedCharacter });
          }
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
  }, [currentProjectId, navigate, searchParams]);

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
    setSelectedAsset,
    setCharacters,
    setAssets,
    setActiveTab,
    setVersions,
    selectedCharacterReferenceInputRef,
    selectedCharacterVoiceReferenceInputRef,
    selectedAssetFileInputRef,
  });

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
                  currentProjectId ? `/workspace?project=${currentProjectId}` : "/projects",
                )
              }
              className={styles.backButton}
            >
              <ArrowLeft className={styles.backIcon} />
              返回工作台
            </Button>
            <div className={styles.headerDivider}></div>
            <div className={styles.pageBrand}>
              <div className={styles.pageBrandIcon}>
                <Film className={styles.icon} />
              </div>
              <span className={styles.pageBrandTitle}>{project?.name ?? "项目"} · 资产库</span>
            </div>
          </div>
          <div className={styles.pageHeaderActions}>
            <Button size="sm" className={styles.createButton} onClick={openCreateDialog}>
              <Plus className={styles.createButtonIcon} />
              新建资产
            </Button>
          </div>
        </div>
      </header>

      <div className={styles.pageBody}>
        <main className={styles.assetMain}>
          {loadError ? <div className={styles.loadError}>{loadError}</div> : null}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as AssetLibraryTab);
              setSelectedAsset(null);
              setShowActionMenu(false);
            }}
            className={styles.assetTabs}
          >
            <div className={styles.assetToolbar}>
              <div className={styles.assetToolbarContent}>
                <TabsList className={styles.tabsList}>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.CHARACTERS} className={styles.tabTrigger}>
                    <Users className={styles.tabIcon} />
                    角色资产
                    <Badge className={styles.tabBadge}>{characters.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.SCENES} className={styles.tabTrigger}>
                    <MapPin className={styles.tabIcon} />
                    场景资产
                    <Badge className={styles.tabBadge}>{sceneAssetCount}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.PROPS} className={styles.tabTrigger}>
                    <Package className={styles.tabIcon} />
                    道具资产
                    <Badge className={styles.tabBadge}>{propAssetCount}</Badge>
                  </TabsTrigger>
                </TabsList>
                <div className={styles.toolbarActions}>
                  <div className={styles.search}>
                    <Search className={styles.searchIcon} />
                    <Input
                      placeholder="搜索资产..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                  <div className={styles.viewToggle}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        viewMode === ASSET_VIEW_MODE.GRID
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode(ASSET_VIEW_MODE.GRID)}
                    >
                      <Grid3x3 className={styles.icon} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        viewMode === ASSET_VIEW_MODE.LIST
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode(ASSET_VIEW_MODE.LIST)}
                    >
                      <List className={styles.icon} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent value={ASSET_LIBRARY_TAB.CHARACTERS} className={styles.tabContent}>
              <div className={styles.collectionScroll}>
                {loading ? (
                  <div className={styles.collectionLoading}>
                    <Loader2 className={styles.collectionLoadingIcon} />
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className={styles.collectionEmpty}>暂无角色资产</div>
                ) : viewMode === ASSET_VIEW_MODE.GRID ? (
                  <div className={styles.characterGrid}>
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() =>
                          setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: character })
                        }
                        className={
                          selectedAsset?.type === ENTITY_TYPE.CHARACTER &&
                          selectedAsset.data.id === character.id
                            ? styles.characterGridCardSelected
                            : styles.characterGridCard
                        }
                      >
                        <div className={styles.characterGridPreview}>
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className={styles.fullSize}
                            />
                          ) : (
                            <Users className={styles.assetGridPlaceholderIcon} />
                          )}
                          <div className={styles.secondaryBadgePosition}>
                            <Badge className={styles.characterBadge}>角色</Badge>
                          </div>
                        </div>
                        <div className={styles.assetGridContent}>
                          <div className={styles.characterNameRow}>
                            <h4 className={styles.assetName}>{character.name}</h4>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className={styles.voiceBadge}>角色语音</Badge>
                            ) : null}
                          </div>
                          <p className={styles.assetGridDescription}>{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.assetList}>
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() =>
                          setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: character })
                        }
                        className={
                          selectedAsset?.type === ENTITY_TYPE.CHARACTER &&
                          selectedAsset.data.id === character.id
                            ? styles.assetListCardSelected
                            : styles.assetListCard
                        }
                      >
                        <div className={styles.characterListPreview}>
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className={styles.assetListImage}
                            />
                          ) : (
                            <Users className={styles.assetListPlaceholderIcon} />
                          )}
                        </div>
                        <div className={styles.assetListContent}>
                          <div className={styles.characterListHeader}>
                            <h4 className={styles.assetName}>{character.name}</h4>
                            <Badge className={styles.characterBadge}>角色</Badge>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className={styles.voiceBadge}>角色语音</Badge>
                            ) : null}
                          </div>
                          <p className={styles.assetListDescription}>{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {[
              {
                value: ASSET_LIBRARY_TAB.SCENES,
                items: filteredSceneAssets,
                emptyLabel: "暂无场景资产",
              },
              {
                value: ASSET_LIBRARY_TAB.PROPS,
                items: filteredPropAssets,
                emptyLabel: "暂无道具资产",
              },
            ].map((collection) => (
              <TabsContent
                key={collection.value}
                value={collection.value}
                className={styles.tabContent}
              >
                <div className={styles.collectionScroll}>
                  <AssetCollection
                    assets={collection.items}
                    emptyLabel={collection.emptyLabel}
                    loading={loading}
                    viewMode={viewMode}
                    selectedAssetId={
                      selectedAsset?.type === ENTITY_TYPE.ASSET ? selectedAsset.data.id : null
                    }
                    onSelect={(asset) => setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: asset })}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>

      <AssetDetailSidebar
        selectedAsset={selectedAsset}
        detailSidebarWidth={detailSidebarWidth}
        isResizingDetailSidebar={isResizingDetailSidebar}
        handleDetailSidebarMouseDown={handleDetailSidebarMouseDown}
        showActionMenu={showActionMenu}
        setShowActionMenu={setShowActionMenu}
        setSelectedAsset={setSelectedAsset}
        setDeleteTarget={setDeleteTarget}
        setPreviewImage={setPreviewImage}
        versions={versions}
        isLoadingVersions={isLoadingVersions}
        switchingVersionId={switchingVersionId}
        openSelectedVersions={() => void openSelectedVersions()}
        chooseSelectedVersion={chooseSelectedVersion}
        openVoiceVersions={() => void openVoiceVersions()}
        isSavingPersonal={isSavingPersonal}
        saveSelectedToPersonal={() => void saveSelectedToPersonal()}
        saveSelectedCharacter={() => void saveSelectedCharacter()}
        saveSelectedAsset={() => void saveSelectedAsset()}
        isSavingCharacter={isSavingCharacter}
        isSavingAsset={isSavingAsset}
        uploadingCharacterReferenceId={uploadingCharacterReferenceId}
        uploadingCharacterVoiceReferenceId={uploadingCharacterVoiceReferenceId}
        generatingCharacterDesignSheetId={generatingCharacterDesignSheetId}
        generatingCharacterVoiceReferenceId={generatingCharacterVoiceReferenceId}
        generatingAssetCoverId={generatingAssetCoverId}
        characterVoiceReferenceError={characterVoiceReferenceError}
        handleGenerateCharacterDesignSheet={() => void handleGenerateCharacterDesignSheet()}
        handleGenerateCharacterVoiceReference={() => void handleGenerateCharacterVoiceReference()}
        handleGenerateAssetCover={() => void handleGenerateAssetCover()}
        handleUploadSelectedCharacterReference={handleUploadSelectedCharacterReference}
        handleUploadSelectedCharacterVoiceReference={handleUploadSelectedCharacterVoiceReference}
        handleUploadSelectedAssetFile={handleUploadSelectedAssetFile}
        selectedCharacterReferenceInputRef={selectedCharacterReferenceInputRef}
        selectedCharacterVoiceReferenceInputRef={selectedCharacterVoiceReferenceInputRef}
        selectedAssetFileInputRef={selectedAssetFileInputRef}
      />

      <AssetLibraryDialogs
        aiPreviewDialog={aiPreviewDialog}
        setAiPreviewDialog={setAiPreviewDialog}
        isLoadingAIPreview={isLoadingAIPreview}
        setPreviewImage={setPreviewImage}
        confirmAIPreviewGeneration={confirmAIPreviewGeneration}
        showVersions={showVersions}
        setShowVersions={setShowVersions}
        versions={versions}
        selectedAsset={selectedAsset}
        switchingVersionId={switchingVersionId}
        chooseSelectedVersion={chooseSelectedVersion}
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
