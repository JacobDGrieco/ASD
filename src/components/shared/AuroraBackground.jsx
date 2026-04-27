import '../../styles/AuroraBackground.css'

export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-bg-noise" />
      <div className="aurora-bg-layer aurora-bg-layer-one" />
      <div className="aurora-bg-layer aurora-bg-layer-two" />
      <div className="aurora-bg-layer aurora-bg-layer-three" />
      <div className="aurora-bg-glow aurora-bg-glow-left" />
      <div className="aurora-bg-glow aurora-bg-glow-right" />
    </div>
  )
}
