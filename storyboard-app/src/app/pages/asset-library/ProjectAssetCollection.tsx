import { Grid3x3, List, Loader2, MapPin, Package, Search, Users } from "lucide-react";

import type { Asset, Character } from "../../api";
import { AssetCollection, ContainedAssetImage } from "../../components/assets/AssetCollection";
import { AssetGenerationStatus } from "../../components/assets/AssetGenerationStatus";
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
import {
  getCharacterPreviewSrc,
  hasCharacterVoiceReference,
  type SelectedAsset,
} from "./AssetLibrary.helpers";
import styles from "./AssetLibrary.module.scss";

type Props = {
  activeTab: AssetLibraryTab;
  onTab: (tab: AssetLibraryTab) => void;
  characters: Character[];
  sceneAssets: Asset[];
  propAssets: Asset[];
  counts: { characters: number; scenes: number; props: number };
  loading: boolean;
  viewMode: AssetViewMode;
  onViewMode: (mode: AssetViewMode) => void;
  searchQuery: string;
  onSearch: (value: string) => void;
  selectedAsset: SelectedAsset;
  onSelect: (asset: SelectedAsset) => void;
};

export function ProjectAssetCollection({
  activeTab,
  onTab,
  characters,
  sceneAssets,
  propAssets,
  counts,
  loading,
  viewMode,
  onViewMode,
  searchQuery,
  onSearch,
  selectedAsset,
  onSelect,
}: Props) {
  const tabs = [
    { value: ASSET_LIBRARY_TAB.CHARACTERS, label: "角色资产", Icon: Users },
    { value: ASSET_LIBRARY_TAB.SCENES, label: "场景资产", Icon: MapPin },
    { value: ASSET_LIBRARY_TAB.PROPS, label: "道具资产", Icon: Package },
  ];
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTab(value as AssetLibraryTab)}
      className={styles.assetTabs}
    >
      <div className={styles.assetToolbar}>
        <div className={styles.assetToolbarContent}>
          <TabsList className={styles.tabsList}>
            {tabs.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value} className={styles.tabTrigger}>
                <Icon className={styles.tabIcon} />
                {label}
                <Badge className={styles.tabBadge}>{counts[value]}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={styles.toolbarActions}>
            <div className={styles.search}>
              <Search className={styles.searchIcon} />
              <Input
                aria-label="搜索资产"
                placeholder="搜索资产..."
                value={searchQuery}
                onChange={(event) => onSearch(event.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.viewToggle}>
              {[
                { value: ASSET_VIEW_MODE.GRID, Icon: Grid3x3, label: "网格视图" },
                { value: ASSET_VIEW_MODE.LIST, Icon: List, label: "列表视图" },
              ].map(({ value, Icon, label }) => (
                <Button
                  key={value}
                  size="sm"
                  variant="ghost"
                  aria-label={label}
                  className={
                    viewMode === value ? styles.viewToggleButtonActive : styles.viewToggleButton
                  }
                  onClick={() => onViewMode(value)}
                >
                  <Icon className={styles.icon} />
                </Button>
              ))}
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
          ) : !characters.length ? (
            <div className={styles.collectionEmpty}>暂无角色资产</div>
          ) : (
            <div
              className={
                viewMode === ASSET_VIEW_MODE.GRID ? styles.characterGrid : styles.assetList
              }
            >
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  grid={viewMode === ASSET_VIEW_MODE.GRID}
                  selected={
                    selectedAsset?.type === ENTITY_TYPE.CHARACTER &&
                    selectedAsset.data.id === character.id
                  }
                  onSelect={() => onSelect({ type: ENTITY_TYPE.CHARACTER, data: character })}
                />
              ))}
            </div>
          )}
        </div>
      </TabsContent>
      {[
        { value: ASSET_LIBRARY_TAB.SCENES, items: sceneAssets, emptyLabel: "暂无场景资产" },
        { value: ASSET_LIBRARY_TAB.PROPS, items: propAssets, emptyLabel: "暂无道具资产" },
      ].map((collection) => (
        <TabsContent key={collection.value} value={collection.value} className={styles.tabContent}>
          <div className={styles.collectionScroll}>
            <AssetCollection
              assets={collection.items}
              emptyLabel={collection.emptyLabel}
              loading={loading}
              viewMode={viewMode}
              selectedAssetId={
                selectedAsset?.type === ENTITY_TYPE.ASSET ? selectedAsset.data.id : null
              }
              onSelect={(asset) => onSelect({ type: ENTITY_TYPE.ASSET, data: asset })}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CharacterCard({
  character,
  grid,
  selected,
  onSelect,
}: {
  character: Character;
  grid: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const cardClass = grid
    ? selected
      ? styles.characterGridCardSelected
      : styles.characterGridCard
    : selected
      ? styles.assetListCardSelected
      : styles.assetListCard;
  return (
    <button className={cardClass} onClick={onSelect}>
      <div className={grid ? styles.characterGridPreview : styles.characterListPreview}>
        {getCharacterPreviewSrc(character) ? (
          <ContainedAssetImage
            src={getCharacterPreviewSrc(character)}
            alt={character.name}
            className={grid ? styles.fullSize : styles.assetListImage}
          />
        ) : (
          <Users
            className={grid ? styles.assetGridPlaceholderIcon : styles.assetListPlaceholderIcon}
          />
        )}
        {grid ? (
          <div className={styles.secondaryBadgePosition}>
            <Badge className={styles.characterBadge}>角色</Badge>
          </div>
        ) : null}
      </div>
      <div className={grid ? styles.assetGridContent : styles.assetListContent}>
        <div className={grid ? styles.characterNameRow : styles.characterListHeader}>
          <h4 className={styles.assetName}>{character.name}</h4>
          {!grid ? <Badge className={styles.characterBadge}>角色</Badge> : null}
          {hasCharacterVoiceReference(character) ? (
            <Badge className={styles.voiceBadge}>角色语音</Badge>
          ) : null}
        </div>
        <p className={grid ? styles.assetGridDescription : styles.assetListDescription}>
          {character.description}
        </p>
        <AssetGenerationStatus
          status={character.design_sheet_status}
          error={character.design_sheet_error}
        />
      </div>
    </button>
  );
}
