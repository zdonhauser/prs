export interface Photo {
  id: string
  /** dataURL captured at upload */
  src: string
  /** captured at upload; undefined if the image failed to load then */
  naturalW?: number
  naturalH?: number
  zoom: number
  panX: number
  panY: number
}

// Mirrors PRS's actual "Good Neighbor Program" success story submission form
// fields, so coordinators answer the same four questions they already know.
export interface AiAnswers {
  situation: string
  highlights: string
  impact: string
  partners: string
}

export interface StoryForm {
  community: string
  coordinator: string
  /** 'YYYY-MM'; either part may be empty mid-selection (see domain/storyDate) */
  date: string
  narrative: string
  /** null = auto-fit to available space */
  narrativeFontSize: number | null
  photos: Photo[]
  photoLayoutIndex: number
  theme: string
  aiAnswers: AiAnswers
}

export type FormFieldUpdater = <K extends keyof StoryForm>(field: K, value: StoryForm[K]) => void

export interface LayoutCell {
  x: number
  y: number
  w: number
  h: number
}

export interface PhotoLayout {
  name: string
  cells: LayoutCell[]
}

export interface CoverRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CropResult {
  zoom: number
  panX: number
  panY: number
}

/** A field rendered as one of the flyer's three fixed detail-row slots (see domain's `layoutDetailRows`). */
export type DetailField = 'date' | 'time' | 'location' | 'additionalInfo'

/** A field rendered as a line in the flyer's footer band (see domain's `layoutFooterFields`). */
export type FooterField = 'rscEmail' | 'phone' | 'address' | 'website'

export type FlyerField = DetailField | FooterField

/**
 * The eight template-controlled colors. The reference flyer also uses a
 * lighter teal for the divider ornament, near-black for the detail labels,
 * and a fixed white for the footer text — those are not template-controlled
 * in v1: the ornament derives from `ring`, the detail labels from
 * `bodyText`, and the footer text is a fixed white.
 */
export interface FlyerColors {
  heroBg: string
  heroPattern: string
  accent: string
  ring: string
  subtitle: string
  iconCircle: string
  bodyText: string
  footerBg: string
}

/** A photo bubble's bounding box, in page px on the 816×1056 basis. */
export interface PhotoBox {
  left: number
  top: number
  width: number
  height: number
}

export interface FlyerTemplate {
  /** schema version */
  v: 1
  id: string
  name: string
  /** 'YYYY-MM'; the month this template is intended for */
  month: string
  eyebrow: string
  headline: string[]
  subtitle: string
  description: string
  photo: {
    /** dataURL, downscaled ≤1600px JPEG */
    src: string
    /** Page px on the 816×1056 basis. Omitted = the measured default (`DEFAULT_PHOTO_BOX`). */
    box?: PhotoBox
  }
  colors: FlyerColors
  watermark: { opacity: number; scale: number; x: number; y: number }
  editableFields: FlyerField[]
}

export interface FlyerForm {
  templateId: string
  values: Record<FlyerField, string>
}
