import {
  ArrowLeft,
  Film,
  Grid3x3,
  List,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
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
} from "../api";
import {
  AssetCollection,
  ContainedAssetImage,
  getAssetKind,
  getAssetKindLabel,
} from "../components/assets/AssetCollection";
import { VersionImageCard } from "../components/assets/VersionImageCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import {
  ASSET_KIND,
  ASSET_LIBRARY_TAB,
  ASSET_VIEW_MODE,
  type AssetLibraryTab,
  type AssetViewMode,
  ENTITY_TYPE,
  GENERATION_STATUS,
} from "../constants/domain";
import type { SelectedAsset } from "./AssetLibrary.helpers";
import {
  CHARACTER_GENERATION_COPY,
  getAssetOriginalSrc,
  getCharacterDesignSheetPreviewSrc,
  getCharacterPreviewSrc,
  getCharacterReferenceSrc,
  getCharacterVoiceReferenceSrc,
  hasCharacterVoiceReference,
} from "./AssetLibrary.helpers";
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

        {selectedAsset ? (
          <>
            <div
              className={`resize-handle resize-handle-left ${styles.resizeHandle} ${isResizingDetailSidebar ? "dragging" : ""}`}
              onMouseDown={handleDetailSidebarMouseDown}
            />

            <aside style={{ width: detailSidebarWidth }} className={styles.detailSidebar}>
              <>
                <div className={styles.detailHeader}>
                  <h3 className={styles.detailTitle}>
                    {selectedAsset.type === ENTITY_TYPE.CHARACTER
                      ? "角色详情"
                      : `${getAssetKindLabel(selectedAsset.data)}详情`}
                  </h3>
                  <div className={styles.detailHeaderActions}>
                    <div className={styles.actionMenuWrap}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="资产操作"
                        aria-expanded={showActionMenu}
                        className={styles.detailIconButton}
                        onClick={() => setShowActionMenu((open) => !open)}
                      >
                        <MoreHorizontal className={styles.icon} />
                      </Button>
                      {showActionMenu ? (
                        <div className={styles.actionMenu}>
                          <button
                            type="button"
                            className={styles.actionMenuItem}
                            onClick={() => {
                              setShowActionMenu(false);
                              void openSelectedVersions();
                            }}
                          >
                            查看生成版本
                          </button>
                          {selectedAsset.type === ENTITY_TYPE.CHARACTER ? (
                            <button
                              type="button"
                              className={styles.actionMenuItem}
                              onClick={() => {
                                setShowActionMenu(false);
                                void openVoiceVersions();
                              }}
                            >
                              查看语音版本
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSavingPersonal}
                            className={styles.actionMenuItem}
                            onClick={() => {
                              setShowActionMenu(false);
                              void saveSelectedToPersonal();
                            }}
                          >
                            保存到个人空间
                          </button>
                          <button
                            type="button"
                            className={styles.actionMenuDelete}
                            onClick={() => {
                              setShowActionMenu(false);
                              setDeleteTarget(
                                selectedAsset.type === ENTITY_TYPE.ASSET
                                  ? {
                                      type: selectedAsset.type,
                                      id: selectedAsset.data.id,
                                      name: selectedAsset.data.name,
                                      assetKind: getAssetKind(selectedAsset.data),
                                    }
                                  : {
                                      type: selectedAsset.type,
                                      id: selectedAsset.data.id,
                                      name: selectedAsset.data.name,
                                    },
                              );
                            }}
                          >
                            删除资产
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={styles.detailIconButton}
                      onClick={() => setSelectedAsset(null)}
                    >
                      <X className={styles.icon} />
                    </Button>
                  </div>
                </div>
                <div className={styles.detailScroll}>
                  {selectedAsset.type === ENTITY_TYPE.CHARACTER ? (
                    <div className={styles.detailSections}>
                      <div className={styles.detailCard}>
                        <div className={styles.detailCardHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>角色参考图</div>
                            <div className={styles.detailCardDescription}>
                              只用于生成主设定图，不参与其他展示和分镜参考链路
                            </div>
                          </div>
                          <Badge className={styles.internalBadge}>内部参考</Badge>
                        </div>
                        <div className={styles.characterReferencePreview}>
                          {getCharacterReferenceSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className={styles.fullSize}
                              onClick={() =>
                                setPreviewImage({
                                  src: getCharacterReferenceSrc(selectedAsset.data),
                                  alt: `${selectedAsset.data.name} 角色参考图`,
                                })
                              }
                            >
                              <ContainedAssetImage
                                src={getCharacterReferenceSrc(selectedAsset.data)}
                                alt={`${selectedAsset.data.name} 角色参考图`}
                                className={styles.assetListImage}
                              />
                            </button>
                          ) : (
                            <Users className={styles.largePlaceholderIcon} />
                          )}
                        </div>
                        <div>
                          <Label className={styles.detailLabel}>角色参考图地址</Label>
                          <Input
                            value={selectedAsset.data.avatar_url || ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: ENTITY_TYPE.CHARACTER,
                                data: { ...selectedAsset.data, avatar_url: e.target.value },
                              })
                            }
                            placeholder="https://..."
                            className={styles.detailInput}
                          />
                        </div>
                        <div className={styles.buttonRow}>
                          <input
                            ref={selectedCharacterReferenceInputRef}
                            type="file"
                            accept="image/*"
                            className={styles.hiddenInput}
                            onChange={(e) =>
                              void handleUploadSelectedCharacterReference(
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryFullButton}
                            disabled={uploadingCharacterReferenceId === selectedAsset.data.id}
                            onClick={() => selectedCharacterReferenceInputRef.current?.click()}
                          >
                            {uploadingCharacterReferenceId === selectedAsset.data.id ? (
                              <>
                                <Loader2 className={styles.buttonLoadingIcon} />
                                上传中
                              </>
                            ) : (
                              <>上传参考图</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className={styles.detailCard}>
                        <div className={styles.detailCardHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>角色主设定图</div>
                            <div className={styles.detailCardDescription}>
                              角色正式展示图，以及后续分镜封面的人物核心参考图
                            </div>
                          </div>
                          <Badge className={styles.secondaryBadge}>角色设定</Badge>
                        </div>
                        <div className={styles.characterDesignPreview}>
                          {getCharacterDesignSheetPreviewSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className={styles.fullSize}
                              onClick={() =>
                                setPreviewImage({
                                  src: selectedAsset.data.design_sheet_url ?? "",
                                  alt: `${selectedAsset.data.name} 设定图`,
                                })
                              }
                            >
                              <ContainedAssetImage
                                src={getCharacterDesignSheetPreviewSrc(selectedAsset.data)}
                                alt={`${selectedAsset.data.name} 设定图`}
                                className={styles.assetListImage}
                              />
                            </button>
                          ) : (
                            <Users className={styles.largePlaceholderIcon} />
                          )}
                        </div>
                        <div className={styles.subsection}>
                          <div className={styles.subsectionHeader}>
                            <div className={styles.detailLabel}>主设定图版本</div>
                            <div className={styles.versionCount}>
                              {isLoadingVersions ? "加载中" : `${versions.length} 个版本`}
                            </div>
                          </div>
                          {versions.length ? (
                            <div className={styles.versionGrid}>
                              {versions.slice(0, 6).map((version, index) => (
                                <VersionImageCard
                                  key={version.id}
                                  version={version}
                                  src={version.file_url}
                                  alt={`${selectedAsset.data.name} 主设定图版本 ${versions.length - index}`}
                                  label={`v${versions.length - index}`}
                                  aspectClassName={styles.aspectSquare}
                                  switching={switchingVersionId === version.id}
                                  onPreview={() =>
                                    setPreviewImage({
                                      src: version.file_url,
                                      alt: `${selectedAsset.data.name} 主设定图版本 ${versions.length - index}`,
                                    })
                                  }
                                  onSetCurrent={() => void chooseSelectedVersion(version)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className={styles.versionsEmpty}>
                              {isLoadingVersions ? "正在加载版本" : "生成后会在这里保留历史版本"}
                            </div>
                          )}
                          {versions.length > 6 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={styles.showAllVersions}
                              onClick={() => void openSelectedVersions()}
                            >
                              查看全部 {versions.length} 个版本
                            </Button>
                          ) : null}
                        </div>
                        {selectedAsset.data.design_sheet_error ? (
                          <div className={styles.inlineError}>
                            {selectedAsset.data.design_sheet_error}
                          </div>
                        ) : null}
                        <div className={styles.subsection}>
                          <div className={styles.modelLabel}>
                            {CHARACTER_GENERATION_COPY.DESIGN_SHEET_MODEL_LABEL}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            disabled={
                              generatingCharacterDesignSheetId === selectedAsset.data.id ||
                              selectedAsset.data.design_sheet_status ===
                                GENERATION_STATUS.GENERATING
                            }
                            onClick={() => void handleGenerateCharacterDesignSheet()}
                          >
                            {generatingCharacterDesignSheetId === selectedAsset.data.id ||
                            selectedAsset.data.design_sheet_status ===
                              GENERATION_STATUS.GENERATING ? (
                              <>
                                <Loader2 className={styles.buttonLoadingIcon} />
                                正在生成主设定图
                              </>
                            ) : (
                              <>
                                <Sparkles className={styles.buttonIcon} />
                                生成主设定图
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>角色名称</Label>
                        <Input
                          value={selectedAsset.data.name}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.CHARACTER,
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className={styles.detailInput}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>角色描述</Label>
                        <Textarea
                          value={selectedAsset.data.description || ""}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.CHARACTER,
                              data: { ...selectedAsset.data, description: e.target.value },
                            })
                          }
                          className={styles.detailTextarea}
                        />
                      </div>
                      <div className={styles.detailCard}>
                        <div className={styles.voiceHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>主语音参考</div>
                            <div className={styles.detailCardDescription}>
                              {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_DURATION_HINT}
                            </div>
                          </div>
                          <Badge className={styles.voiceStatusBadge}>角色语音</Badge>
                        </div>
                        {characterVoiceReferenceError?.id === selectedAsset.data.id ? (
                          <div className={styles.voiceError}>
                            {characterVoiceReferenceError.message}
                          </div>
                        ) : null}
                        {selectedAsset.data.voice_reference_error ? (
                          <div className={styles.inlineError}>
                            {selectedAsset.data.voice_reference_error}
                          </div>
                        ) : null}
                        {getCharacterVoiceReferenceSrc(selectedAsset.data) ? (
                          <audio
                            key={selectedAsset.data.voice_reference_url}
                            controls
                            className={styles.fullWidth}
                          >
                            <source src={getCharacterVoiceReferenceSrc(selectedAsset.data)} />
                          </audio>
                        ) : (
                          <div className={styles.audioEmpty}>
                            还没有主语音参考。生成后会自动绑定到这个角色。
                          </div>
                        )}
                        <div>
                          <Label className={styles.detailLabel}>声音提示词</Label>
                          <Textarea
                            value={selectedAsset.data.voice_prompt ?? ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: ENTITY_TYPE.CHARACTER,
                                data: { ...selectedAsset.data, voice_prompt: e.target.value },
                              })
                            }
                            className={styles.voiceTextarea}
                            placeholder="例如：年轻男性，低沉克制，略带疲惫感，真实自然，不要播音腔。"
                          />
                          <div className={styles.fieldHint}>
                            系统会在生成时追加 3-5 秒短句约束。
                          </div>
                        </div>
                        <div>
                          <Label className={styles.detailLabel}>参考文本</Label>
                          <div className={styles.referenceText}>
                            {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_TEXT}
                          </div>
                          <div className={styles.fieldHint}>
                            {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_TEXT_HINT}
                          </div>
                        </div>
                        {selectedAsset.data.voice_name ||
                        selectedAsset.data.voice_reference_duration ? (
                          <div className={styles.voiceMetadata}>
                            <div className={styles.voiceMetadataCard}>
                              <div className={styles.voiceMetadataLabel}>音色名称</div>
                              <div className={styles.voiceMetadataValueBreak}>
                                {selectedAsset.data.voice_name ?? "未生成"}
                              </div>
                            </div>
                            <div className={styles.voiceMetadataCard}>
                              <div className={styles.voiceMetadataLabel}>音频时长</div>
                              <div className={styles.voiceMetadataValue}>
                                {selectedAsset.data.voice_reference_duration
                                  ? `${selectedAsset.data.voice_reference_duration.toFixed(1)}s`
                                  : "未生成"}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={
                            generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                            selectedAsset.data.voice_reference_status ===
                              GENERATION_STATUS.GENERATING
                          }
                          onClick={() => void handleGenerateCharacterVoiceReference()}
                        >
                          {generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                          selectedAsset.data.voice_reference_status ===
                            GENERATION_STATUS.GENERATING ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              生成中
                            </>
                          ) : (
                            <>
                              <Sparkles className={styles.buttonIcon} />
                              生成主语音参考
                            </>
                          )}
                        </Button>
                        <input
                          ref={selectedCharacterVoiceReferenceInputRef}
                          type="file"
                          accept="audio/wav,audio/mpeg,.wav,.mp3"
                          className={styles.hiddenInput}
                          onChange={(event) =>
                            void handleUploadSelectedCharacterVoiceReference(
                              event.target.files?.[0] ?? null,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={uploadingCharacterVoiceReferenceId === selectedAsset.data.id}
                          onClick={() => selectedCharacterVoiceReferenceInputRef.current?.click()}
                        >
                          {uploadingCharacterVoiceReferenceId === selectedAsset.data.id ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              上传中
                            </>
                          ) : (
                            <>
                              <Upload className={styles.buttonIcon} />
                              上传/替换主语音参考
                            </>
                          )}
                        </Button>
                      </div>
                      <div className={styles.detailFooter}>
                        <Button
                          className={styles.saveButton}
                          disabled={isSavingCharacter}
                          onClick={() => void saveSelectedCharacter()}
                        >
                          {isSavingCharacter ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className={styles.buttonIcon} />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className={styles.deleteButton}
                          onClick={() =>
                            setDeleteTarget({
                              type: ENTITY_TYPE.CHARACTER,
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                            })
                          }
                        >
                          {" "}
                          <Trash2 className={styles.buttonIcon} /> 删除角色
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.detailSections}>
                      <div className={styles.assetMediaGrid}>
                        {[
                          { label: "原始素材", src: getAssetOriginalSrc(selectedAsset.data) },
                          { label: "AI 封面", src: selectedAsset.data.cover_url ?? "" },
                        ].map((media) => (
                          <div key={media.label} className={styles.mediaItem}>
                            <div className={styles.detailLabel}>{media.label}</div>
                            <button
                              type="button"
                              disabled={!media.src}
                              className={styles.mediaPreview}
                              onClick={() =>
                                media.src && setPreviewImage({ src: media.src, alt: media.label })
                              }
                            >
                              {media.src ? (
                                <ContainedAssetImage
                                  src={media.src}
                                  alt={media.label}
                                  className={styles.fullSize}
                                />
                              ) : (
                                <MapPin className={styles.mediaPlaceholderIcon} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        ref={selectedAssetFileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.hiddenInput}
                        onChange={(event) =>
                          void handleUploadSelectedAssetFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={styles.secondaryButton}
                        onClick={() => selectedAssetFileInputRef.current?.click()}
                      >
                        <Upload className={styles.buttonIcon} />
                        替换原始素材
                      </Button>
                      {selectedAsset.data.cover_error ? (
                        <div className={styles.inlineError}>{selectedAsset.data.cover_error}</div>
                      ) : null}
                      {selectedAsset.data.type === ASSET_KIND.SCENE ||
                      selectedAsset.data.type === ASSET_KIND.PROP ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={
                            generatingAssetCoverId === selectedAsset.data.id ||
                            selectedAsset.data.cover_status === GENERATION_STATUS.GENERATING
                          }
                          onClick={() => void handleGenerateAssetCover()}
                        >
                          {generatingAssetCoverId === selectedAsset.data.id ||
                          selectedAsset.data.cover_status === GENERATION_STATUS.GENERATING ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              正在生成
                            </>
                          ) : (
                            <>
                              <Sparkles className={styles.buttonIcon} />
                              生成封面
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className={styles.unsupportedNotice}>当前类型不支持 AI 生成封面。</div>
                      )}
                      <div>
                        <Label className={styles.detailLabel}>
                          {getAssetKindLabel(selectedAsset.data)}名称
                        </Label>
                        <Input
                          value={selectedAsset.data.name}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className={styles.detailInput}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>资源类型</Label>
                        <Select
                          value={
                            selectedAsset.data.type === ASSET_KIND.PROP
                              ? ASSET_KIND.PROP
                              : ASSET_KIND.SCENE
                          }
                          onValueChange={(value) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, type: value },
                            })
                          }
                        >
                          <SelectTrigger className={styles.detailInput}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ASSET_KIND.SCENE}>场景</SelectItem>
                            <SelectItem value={ASSET_KIND.PROP}>道具</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>
                          {getAssetKindLabel(selectedAsset.data)}描述
                        </Label>
                        <Textarea
                          value={selectedAsset.data.meta ?? ""}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, meta: e.target.value },
                            })
                          }
                          className={styles.detailTextarea}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>资源地址</Label>
                        <Textarea
                          value={selectedAsset.data.file_url || ""}
                          className={styles.urlTextarea}
                          readOnly
                        />
                      </div>
                      <div className={styles.detailFooter}>
                        <Button
                          className={styles.saveButton}
                          disabled={isSavingAsset}
                          onClick={() => void saveSelectedAsset()}
                        >
                          {isSavingAsset ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className={styles.buttonIcon} />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className={styles.deleteButton}
                          onClick={() =>
                            setDeleteTarget({
                              type: ENTITY_TYPE.ASSET,
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                              assetKind: getAssetKind(selectedAsset.data),
                            })
                          }
                        >
                          <Trash2 className={styles.buttonIcon} />
                          删除资产
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            </aside>
          </>
        ) : null}
      </div>

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
