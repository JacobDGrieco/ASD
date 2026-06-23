import { useId } from 'react'

// value: [{ talentId, roleLabel }]
// talentOptions: [{ id, name, role }]
export default function CreditsField({ value, onChange, talentOptions, placeholder = 'Add a credit' }) {
  const selectId = useId()
  const credits = Array.isArray(value) ? value : []

  const addCredit = () => {
    onChange([...credits, { talentId: '', roleLabel: '' }])
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
                value={credit.talentId}
                onChange={(event) => updateCredit(index, { talentId: event.target.value })}
                className="admin-artists-page-input"
              >
                <option value="">- Select person -</option>
                {talentOptions.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Role label (e.g. Photographer)"
                value={credit.roleLabel}
                onChange={(event) => updateCredit(index, { roleLabel: event.target.value })}
                className="admin-artists-page-input"
              />
              <button
                type="button"
                onClick={() => removeCredit(index)}
                className="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                aria-label="Remove credit"
                title="Remove credit"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addCredit} className="admin-artists-page-ghost-btn">
        {placeholder}
      </button>
    </div>
  )
}
