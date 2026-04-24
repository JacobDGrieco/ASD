import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LyricsView from './LyricsView.jsx'

const fakeBlocks = [
  {
    id: 'lb1',
    text: 'Yeah I been movin in silence',
    blockOrder: 0,
    annotations: [{ id: 'a1', startChar: 0, endChar: 28, explanation: 'The artist is operating without attention.' }],
  },
  {
    id: 'lb2',
    text: 'They never see me comin',
    blockOrder: 1,
    annotations: [],
  },
]

describe('LyricsView', () => {
  it('renders all lyric lines', () => {
    render(<LyricsView blocks={fakeBlocks} />)
    expect(screen.getByText(/movin in silence/)).toBeInTheDocument()
    expect(screen.getByText('They never see me comin')).toBeInTheDocument()
  })

  it('annotated phrase is rendered as a button', () => {
    render(<LyricsView blocks={fakeBlocks} />)
    const annotated = screen.getByRole('button', { name: /movin in silence/ })
    expect(annotated).toBeInTheDocument()
  })

  it('clicking annotated phrase opens popup with explanation', () => {
    render(<LyricsView blocks={fakeBlocks} />)
    expect(screen.queryByText('The artist is operating without attention.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /movin in silence/ }))
    expect(screen.getByText('The artist is operating without attention.')).toBeInTheDocument()
  })

  it('clicking the same phrase again closes the popup', () => {
    render(<LyricsView blocks={fakeBlocks} />)
    const btn = screen.getByRole('button', { name: /movin in silence/ })
    fireEvent.click(btn)
    expect(screen.getByText('The artist is operating without attention.')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText('The artist is operating without attention.')).not.toBeInTheDocument()
  })
})
