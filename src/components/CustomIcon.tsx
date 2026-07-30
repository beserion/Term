import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faXmark,
  faChevronDown,
  faChevronRight,
  faBarcode,
  faRightLeft,
  faTruckFast,
  faBuilding,
  faGear,
  faBox,
  faBoxesStacked,
  faCalendarDays,
  faDeleteLeft,
  faDownload,
  faTruck,
  faMinus,
  faPlus,
  faCirclePlus,
  faCircleMinus,
  faUser,
  faFloppyDisk,
  faRightFromBracket,
  faRightToBracket,
  faMagnifyingGlass,
  faPenToSquare,
  faStore,
  faWarehouse,
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
  faLock,
  faTrashCan,
  faArrowLeft,
  faBars,
  faEye,
  faEyeSlash,
  faSpinner,
  faClipboardQuestion,
  faClipboardCheck,
  faClipboardList,
  faCheckCircle as faCheckCircleSolid,
  faLink,
  faLinkSlash,
  faCircleDot,
  faPrint,
  faCamera,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';

import {
  faPlayCircle,
  faCheckCircle as faCheckCircleRegular,
  faCircle,
} from '@fortawesome/free-regular-svg-icons';

// MaterialCommunityIcons name mappings to FontAwesome icons
const IconMap: Record<string, any> = {
  // Common / Actions
  'close': faXmark,
  'backspace-outline': faDeleteLeft,
  'arrow-left': faArrowLeft,
  'menu': faBars,
  'magnify': faMagnifyingGlass,
  'pencil-box-outline': faPenToSquare,
  'trash-can-outline': faTrashCan,
  'delete': faTrashCan,
  'content-save': faFloppyDisk,
  'cog': faGear,
  'cog-outline': faGear,
  'loading': faSpinner,
  'eye': faEye,
  'eye-off': faEyeSlash,
  'calendar-month': faCalendarDays,
  'link-variant': faLink,
  'link-variant-off': faLinkSlash,
  'printer': faPrint,
  'camera': faCamera,
  'camera-off': faCamera,
  'flash': faBolt,
  'flash-off': faBolt,

  // Auth
  'warehouse': faWarehouse,
  'account': faUser,
  'account-outline': faUser,
  'account-circle': faUser,
  'lock-outline': faLock,
  'login': faRightToBracket,
  'logout': faRightFromBracket,

  // Status / Alerts
  'alert-circle': faCircleExclamation,
  'alert-circle-outline': faCircleExclamation,
  'alert-octagon': faTriangleExclamation,
  'check-circle': faCheckCircleSolid,
  'check-circle-outline': faCheckCircleRegular,
  'play-circle-outline': faPlayCircle,
  'information': faCircleInfo,
  'radiobox-marked': faCircleDot,
  'radiobox-blank': faCircle,

  // Inventory / Stock
  'barcode-scan': faBarcode,
  'package-variant': faBox,
  'package-variant-closed': faBoxesStacked,
  'package-down': faDownload,
  'minus': faMinus,
  'plus': faPlus,
  'minus-circle': faCircleMinus,
  'minus-circle-outline': faCircleMinus,
  'plus-circle': faCirclePlus,
  'plus-circle-outline': faCirclePlus,
  'swap-horizontal': faRightLeft,
  'office-building-marker': faBuilding,

  // Shipping / Receiving
  'truck-fast': faTruckFast,
  'truck-delivery': faTruckFast,
  'truck-delivery-outline': faTruck,
  'storefront': faStore,
  'clipboard-check-outline': faClipboardCheck,
  'clipboard-alert-outline': faClipboardQuestion,
  'clipboard-list-outline': faClipboardList,
  'clipboard-text-outline': faClipboardList,
  'chevron-down': faChevronDown,
  'chevron-right': faChevronRight,
};

interface CustomIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function CustomIcon({ name, size = 24, color, style }: CustomIconProps) {
  // Get corresponding FontAwesome icon, fallback to faQuestion if not mapped
  const fontAwesomeIcon = IconMap[name] || faCircleExclamation;

  return (
    <FontAwesomeIcon
      icon={fontAwesomeIcon}
      size={size}
      color={color}
      style={style as any}
    />
  );
}
