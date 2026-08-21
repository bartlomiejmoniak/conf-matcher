import type { LoadedData } from '../lib/data';
import type { PaperProfile, TrackedPaper, VenueView } from '../lib/types';
import type { CostInputs } from '../lib/costing';

/** The props every view receives from App. */
export interface ViewProps {
  data: LoadedData;
  views: VenueView[];
  byId: Map<string, VenueView>;
  saved: string[];
  papers: Record<string, TrackedPaper[]>;
  paper: PaperProfile;
  compare: string[];
  toggleSaved: (id: string) => void;
  toggleCompare: (id: string) => void;
  openDetail: (id: string) => void;
  trackedCount: (id: string) => number;
  costs: Record<string, CostInputs>;
  setCost: (venueId: string, next: CostInputs) => void;
}

