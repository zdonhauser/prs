import React from 'react'
import { photoLayouts } from '@/config/photoLayouts'
import { normalizeImageFile } from '@/services/imageConversion'
import type { Photo, LayoutCell } from '@/types'

interface PhotoSectionProps {
  photos: Photo[]
  layoutIndex: number
  onPhotosChange: (photos: Photo[]) => void
  onLayoutChange: (index: number) => void
}

export function PhotoSection({ photos, layoutIndex, onPhotosChange, onLayoutChange }: PhotoSectionProps) {
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const slots = 8 - photos.length
    const toAdd = files.slice(0, slots)
    e.target.value = ''
    if (!toAdd.length) return

    Promise.all(
      toAdd.map(async (file, i) => {
        try {
          const normalized = await normalizeImageFile(file)
          return await readAsPhoto(normalized, i)
        } catch (err) {
          // HEIC/TIFF conversion failed — skip this photo rather than
          // silently adding a broken one; the rest of the batch still goes through.
          alert(err instanceof Error ? err.message : `Couldn't add "${file.name}".`)
          return null
        }
      })
    ).then((results) => {
      const added = results.filter((p): p is Photo => p !== null)
      if (added.length) onPhotosChange([...photos, ...added])
    })
  }

  const remove = (idx: number) => onPhotosChange(photos.filter((_, i) => i !== idx))

  function readAsPhoto(file: File, i: number): Promise<Photo> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error(`Couldn't read "${file.name}".`))
      reader.onload = (ev) => {
        const src = ev.target?.result as string
        const img = new window.Image()
        const finish = () => resolve({
          id: `photo_${Date.now()}_${i}`,
          src,
          naturalW: img.naturalWidth || undefined,
          naturalH: img.naturalHeight || undefined,
          zoom: 1,
          panX: 0,
          panY: 0,
        })
        img.onload = finish
        img.onerror = finish
        img.src = src
      }
      reader.readAsDataURL(file)
    })
  }

  const move = (idx: number, dir: number) => {
    const next = [...photos]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onPhotosChange(next)
  }

  const layouts = photos.length > 0 ? (photoLayouts[photos.length] || []) : []

  return (
    <section className="form-section">
      <h2>Photos</h2>

      {/* Deliberately NOT using the "image/*" MIME wildcard here: both
          Safari and Chrome's native macOS file picker filter out HEIC/HEIF
          entirely whenever accept includes an image/* (or any image/…)
          MIME type, even though macOS itself can read them — a known,
          still-open bug in both engines (WebKit #212489, Chromium
          #375118901). Listing extensions explicitly, with no MIME
          wildcard, is the documented workaround.

          Opened by the label below rather than a scripted click on a
          display:none input — see .file-input-visually-hidden in form.css.
          Rendered unconditionally, even at eight photos when the label is
          gone, so the id it's addressed by never disappears mid-session. */}
      <input
        id="story-photos-input"
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.avif,.heic,.heif,.tif,.tiff"
        multiple
        className="file-input-visually-hidden"
        onChange={handleFiles}
      />
      {photos.length < 8 && (
        <label className="btn-upload" htmlFor="story-photos-input">
          + Add Photos {photos.length > 0 ? `(${photos.length} of 8)` : '— up to 8'}
        </label>
      )}

      {photos.length > 0 && (
        <>
          <div className="photo-thumb-list">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-thumb">
                <img src={p.src} alt={`Photo ${i + 1}`} />
                <div className="thumb-num">{i + 1}</div>
                <div className="thumb-controls">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">‹</button>
                  <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label="Move right">›</button>
                  <button onClick={() => remove(i)} className="thumb-remove" aria-label="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>

          {layouts.length > 1 && (
            <div className="layout-picker">
              <div className="layout-picker-label">Arrangement</div>
              <div className="layout-options">
                {layouts.map((layout, i) => (
                  <button
                    key={i}
                    className={`layout-option ${i === layoutIndex ? 'active' : ''}`}
                    onClick={() => onLayoutChange(i)}
                    title={layout.name}
                  >
                    <LayoutThumb cells={layout.cells} />
                    <span>{layout.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function LayoutThumb({ cells }: { cells: LayoutCell[] }) {
  return (
    <svg width="60" height="41" viewBox="0 0 696 380" xmlns="http://www.w3.org/2000/svg">
      {cells.map((c, i) => (
        <rect key={i} x={c.x + 1} y={c.y + 1} width={c.w - 2} height={c.h - 2} fill="#c5d8f0" stroke="#2056a0" strokeWidth="3" />
      ))}
    </svg>
  )
}
