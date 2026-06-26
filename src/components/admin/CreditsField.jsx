import { useId } from 'react'

const fashionCreditRoles = [
  'Model',
  'Designer',
  'Stylist',
  'Wardrobe Stylist',
  'Creative Director',
  'Art Director',
  'Photographer',
  'Photo Assistant',
  'Digital Tech',
  'Retoucher',
  'Makeup Artist',
  'Hair Stylist',
  'Nail Artist',
  'Set Designer',
  'Tailor',
  'Seamstress',
  'Producer',
  'Casting Director',
  'Location Scout',
  'Brand',
  'Agency',
  'Other',
]

// value: [{ talentId?, creditName, roleLabel }]
export default function CreditsField({ value, onChange, placeholder = 'Add a credit' }) {
  const selectId = useId()
  const credits = Array.isArray(value) ? value : []

  const addCredit = () => {
    onChange([...credits, { talentId: '', creditName: '', roleLabel: '' }])
  }

  const updateCredit = (index, patch) => {
    onChange(credits.map((credit, i) => (i === index ? { ...credit, ...patch } : credit)))
  }

  const removeCredit = (index) => {
    onChange(credits.filter((_, i) => i !== index))
  }

  return (
    <div className="admin-credits-field">
      {credits.length > 0 && (
        <div className="admin-credits-field-list">
          {credits.map((credit, index) => (
            <div key={index} className="admin-credits-field-row">
              <select
                id={index === 0 ? selectId : undefined}
                value={credit.roleLabel ?? ''}
                onChange={(event) => updateCredit(index, { roleLabel: event.target.value })}
                className="admin-artists-page-input"
              >
                <option value="">- Role -</option>
                {fashionCreditRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Credit name"
                value={credit.creditName ?? ''}
                onChange={(event) => updateCredit(index, { creditName: event.target.value })}
                className="admin-artists-page-input"
              />
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
          ))}
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
