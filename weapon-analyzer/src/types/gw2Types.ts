// src/types/gw2Types.ts
export interface Item {
  id: number;
  name: string;
  type?: string;
  details?: {
    type: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ItemCache {
  [itemId: string]: Item;
}

export interface WeaponCount {
  count: number;
  ids: number[];
}

export interface WeaponCounts {
  [weaponType: string]: WeaponCount;
}

export interface CharacterItemDetail {
  itemId: number;
  template: string;
}

export interface CharacterItemDict {
  [charName: string]: CharacterItemDetail[];
}

export interface LegendaryItemsByGen {
  [generation: string]: number[];
}

export interface EquipmentItem {
  id: number;
  slot: string;
  location: string;
  [key: string]: any;
}

export interface EquipmentTab {
  name?: string;
  equipment?: EquipmentItem[];
  [key: string]: any;
}