/**
 * Every icon the app uses, in one place.
 *
 * The design system mandates Lucide (see the readme under `_ds/`) but ships none, so this
 * is the one module that imports from `lucide-react`. Keeping the surface here means the
 * set can be audited — and pruned — without walking the views.
 *
 * Sizing: 13px matches the 12–13px button text these sit beside, 11px the small pills.
 * Everything strokes `currentColor`, so the accent-fill states invert for free.
 */
export {
  Save,
  ArrowLeftRight,
  Globe,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  X,
  Check,
  ExternalLink,
  ArrowLeft,
  ListChecks,
  Moon,
  Sun,
  Flag,
  Plus,
  FileText,
  Calculator,
} from 'lucide-react';

/** The size every inline icon uses unless it sits beside smaller text. */
export const ICON = 13;
export const ICON_SM = 11;
