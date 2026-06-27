import { useId } from 'react'
import CrewPickerField from './CrewPickerField.jsx'

const fashionCreditRoles = [
  'Model',
  'Photographer',
  'Agency',
  'Brand',
  'Stylist',
  'Wardrobe Stylist',
  'Designer',
  'Creative Director',
  'Art Director',
  'Makeup Artist',
  'Hair Stylist',
  'Nail Artist',
  'Casting Director',
  'Producer',
  'Set Designer',
  'Photo Assistant',
  'Digital Tech',
  'Retoucher',
  'Tailor',
  'Seamstress',
  'Location Scout',
  'Editor',
  'Other',
]

function selectedCreditImage(credit, talentOptions, crewOptions) {
  const selected = credit.talentId
    ? talentOptions.find((person) => person.id === credit.talentId)
    : credit.crewId
      ? crewOptions.find((person) => person.id === credit.crewId)
      : null

  return selected?.image ?? null
}

// value: [{ talentId?, crewId?, creditName, roleLabel }]
export default function CreditsField({ value, onChange, talentOptions = [], crewOptions = [], placeholder = 'Add a credit' }) {
  const selectId = useId()
  const credits = Array.isArray(value) ? value : []

  const addCredit = () => {
    onChange([...credits, { talentId: '', crewId: '', creditName: '', roleLabel: '' }])
  }

  const updateCredit = (index, patch) => {
    onChange(credits.map((credit, i) => {
      if (i !== index) return credit

      const next = { ...credit, ...patch }
      if (patch._prefillRole && !credit.roleLabel) next.roleLabel = patch._prefillRole
      delete next._prefillRole
      return next
    }))
  }

  const removeCredit = (index) => {
    onChange(credits.filter((_, i) => i !== index))
  }

  return (
    <div className="admin-credits-field">
      {credits.length > 0 && (
        <div className="admin-credits-field-list">
          {credits.map((credit, index) => {
            const image = selectedCreditImage(credit, talentOptions, crewOptions)

            return (
              <div key={index} className="admin-credits-field-row">
                <div className="admin-credits-person-thumb" aria-hidden="true">
                  {image ? (
                    <img src={image.previewUrl || image.url} alt="" className="admin-credits-person-thumb-img" />
                  ) : null}
                </div>
                <CrewPickerField
                  creditName={credit.creditName ?? ''}
                  talentId={credit.talentId ?? ''}
                  crewId={credit.crewId ?? ''}
                  talentOptions={talentOptions}
                  crewOptions={crewOptions}
                  onChange={(patch) => updateCredit(index, patch)}
                />
                <select
                  id={index === 0 ? selectId : undefined}
                  value={credit.roleLabel ?? ''}
                  onChange={(event) => updateCredit(index, { roleLabel: event.target.value })}
                  className="admin-artists-page-input admin-credits-role-select"
                >
                  <option value="">- Role -</option>
                  {fashionCreditRoles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeCredit(index)}
                  className="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                  aria-label="Remove credit"
                  title="Remove credit"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={addCredit}
        className="admin-artists-page-ghost-btn admin-full-width-icon-btn"
        aria-label={placeholder}
        title={placeholder}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
