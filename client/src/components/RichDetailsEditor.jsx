import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { createLowlight } from 'lowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import jsLang from 'highlight.js/lib/languages/javascript'
import pyLang from 'highlight.js/lib/languages/python'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from 'prosemirror-state'

// Initialize lowlight defensively to avoid crashing the editor on env differences
let lowlight
try {
  lowlight = createLowlight()
  try { lowlight.registerLanguage('javascript', jsLang) } catch {}
  try { lowlight.registerLanguage('python', pyLang) } catch {}
} catch {
  lowlight = undefined
}

export default function RichDetailsEditor({ valueJSON, onUpdateJSON, onUpdatePlain, className, openShortcutsSignal }) {
  const [tick, setTick] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [quickPos, setQuickPos] = useState(null)
  const [quickGroup, setQuickGroup] = useState(null)
  const [quickAnchor, setQuickAnchor] = useState(null)
  const safeDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
  // Build extensions progressively; avoid throwing if an optional ext fails
  const ModShortcuts = Extension.create({
    name: 'modShortcuts',
    addKeyboardShortcuts() {
      return {
        'Mod-Shift--': () => {
          // Insert horizontal rule
          return this.editor.chain().focus().setHorizontalRule().run()
        },
        'Mod-k': () => {
          // Prompt for URL and toggle link
          const prev = this.editor.getAttributes('link').href || ''
          const url = window.prompt('Enter URL', prev)
          if (url === null) return true
          if (url === '') {
            return this.editor.chain().focus().extendMarkRange('link').unsetLink().run()
          }
          return this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
      }
    }
  })

  // Reset inline marks when pressing Enter (new paragraph starts clean)
  const ResetMarksOnEnter = Extension.create({
    name: 'resetMarksOnEnter',
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          try {
            // clear stored marks so new paragraph doesn't inherit styles
            const chain = this.editor.chain().unsetAllMarks()
            // then perform normal split behavior
            if (this.editor.can().splitBlock()) {
              chain.splitBlock()
            }
            chain.run()
            return true
          } catch {
            return false
          }
        }
      }
    }
  })

  // Slash command extension (must be registered before editor initialization)
  // Shared groups builder for both Slash menu and Quick actions
  const buildActionGroups = (editor) => ([
    {
      type: 'group', label: 'Headings & Blocks', children: [
        { type:'action', title: 'Heading 1', run: () => editor.chain().focus().toggleHeading({ level:1 }).run(), isActive: () => editor.isActive('heading', { level:1 }) },
        { type:'action', title: 'Heading 2', run: () => editor.chain().focus().toggleHeading({ level:2 }).run(), isActive: () => editor.isActive('heading', { level:2 }) },
        { type:'action', title: 'Heading 3', run: () => editor.chain().focus().toggleHeading({ level:3 }).run(), isActive: () => editor.isActive('heading', { level:3 }) },
        { type:'action', title: 'Quote', run: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
        { type:'action', title: 'Code', run: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
        { type:'action', title: 'Code Block', run: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
      ]
    },
    // Standalone inline and rules
    { type:'action', title: 'Bold (B)', run: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
    { type:'action', title: 'Italic (I)', run: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
    { type:'action', title: 'Underline (U)', run: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline') },
    { type:'action', title: 'Strikethrough (S)', run: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    { type:'action', title: 'Highlight (H)', run: () => editor.chain().focus().toggleHighlight().run(), isActive: () => editor.isActive('highlight') },
    { type:'action', title: 'Horizontal Rule (HR)', run: () => editor.chain().focus().setHorizontalRule().run(), isActive: () => false },
    {
      type: 'group', label: 'Lists', children: [
        { type:'action', title: 'Bullet List (UL)', run: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
        { type:'action', title: 'Ordered List (OL)', run: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
        { type:'action', title: 'Task List', run: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive('taskList') },
      ]
    },
    { type:'action', title: 'Table (2x2)', run: () => editor.chain().focus().insertTable({ rows:2, cols:2, withHeaderRow: true }).run(), isActive: () => editor.isActive('table') },
    { type:'action', title: 'Paragraph', run: () => editor.chain().focus().clearNodes().unsetAllMarks().setParagraph().run(), isActive: () => editor.isActive('paragraph') },
  ])

  const SlashCommand = Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      const editor = this.editor
      const groups = buildActionGroups(editor)

      const flattenActions = (arr) => arr.flatMap(item => item.type === 'group' ? item.children : [item])

      return [
        Suggestion({
          pluginKey: new PluginKey('slashMenu'),
          editor,
          char: '/',
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = (query||'').toLowerCase()
            if (!q) return groups
            const acts = flattenActions(groups)
            return acts.filter(a => a.title.toLowerCase().includes(q)).slice(0, 10)
          },
          render: () => {
            let el, submenuEl
            let currentItems = []
            let idxMain = 0
            let currentGroup = null
            let idxSub = -1
            const closeSubmenu = () => {
              if (submenuEl && submenuEl.parentNode) submenuEl.parentNode.removeChild(submenuEl)
              submenuEl = null
              currentGroup = null
              idxSub = -1
            }
            return {
              onStart: props => {
                // reset indices/state for a fresh session
                currentItems = []
                idxMain = 0
                currentGroup = null
                idxSub = -1
                el = document.createElement('div')
                el.className = 'slash-menu'
                el.style.position = 'absolute'
                el.style.zIndex = '1000'
                document.body.appendChild(el)
                const rect = props.clientRect?.()
                if (rect) {
                  el.style.left = `${rect.left + window.scrollX}px`
                  el.style.top = `${rect.top + window.scrollY + 22}px`
                }
                const renderSubmenu = (group, anchorRow) => {
                  closeSubmenu()
                  submenuEl = document.createElement('div')
                  submenuEl.className = 'slash-submenu'
                  const r = anchorRow.getBoundingClientRect()
                  submenuEl.style.position = 'absolute'
                  submenuEl.style.left = `${r.right + window.scrollX + 6}px`
                  submenuEl.style.top = `${r.top + window.scrollY}px`
                  group.children.forEach((child, i) => {
                    const c = document.createElement('div')
                    c.className = 'slash-item' + (i === idxSub ? ' active' : '')
                    c.textContent = child.title
                    c.addEventListener('mousedown', ev => { ev.preventDefault(); props.command(child) })
                    submenuEl.appendChild(c)
                  })
                  document.body.appendChild(submenuEl)
                }
                const renderList = (items) => {
                  currentItems = items
                  el.innerHTML = ''
                  items.forEach((item, idx) => {
                    const row = document.createElement('div')
                    row.className = 'slash-item' + (idx === idxMain ? ' active' : '')
                    row.textContent = item.type === 'group' ? `${item.label} ?` : item.title
                    row.addEventListener('mousedown', e => {
                      e.preventDefault()
                      if (item.type === 'group') {
                        currentGroup = item
                        idxSub = 0
                        renderSubmenu(item, row)
                      } else {
                        props.command(item)
                      }
                    })
                    el.appendChild(row)
                  })
                }
                renderList(props.items)
              },
              onKeyDown: props => {
                const e = props.event
                if (e.key === 'Escape') {
                  e.preventDefault()
                  if (submenuEl) { closeSubmenu(); return true }
                  props.exit()
                  return true
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (submenuEl && currentGroup) {
                    idxSub = (idxSub + 1) % currentGroup.children.length
                    renderSubmenu(currentGroup, el.children[idxMain])
                  } else {
                    idxMain = (idxMain + 1) % currentItems.length
                    // re-render main list to reflect active highlight
                    const items = currentItems
                    el.innerHTML = ''
                    items.forEach((item, idx) => {
                      const row = document.createElement('div')
                      row.className = 'slash-item' + (idx === idxMain ? ' active' : '')
                      row.textContent = item.type === 'group' ? `${item.label} ?` : item.title
                      row.addEventListener('mousedown', ev => {
                        ev.preventDefault()
                        if (item.type === 'group') {
                          currentGroup = item
                          idxSub = 0
                          renderSubmenu(item, row)
                        } else {
                          props.command(item)
                        }
                      })
                      el.appendChild(row)
                    })
                  }
                  return true
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (submenuEl && currentGroup) {
                    idxSub = (idxSub - 1 + currentGroup.children.length) % currentGroup.children.length
                    renderSubmenu(currentGroup, el.children[idxMain])
                  } else {
                    idxMain = (idxMain - 1 + currentItems.length) % currentItems.length
                    const items = currentItems
                    el.innerHTML = ''
                    items.forEach((item, idx) => {
                      const row = document.createElement('div')
                      row.className = 'slash-item' + (idx === idxMain ? ' active' : '')
                      row.textContent = item.type === 'group' ? `${item.label} ?` : item.title
                      row.addEventListener('mousedown', ev => {
                        ev.preventDefault()
                        if (item.type === 'group') {
                          currentGroup = item
                          idxSub = 0
                          renderSubmenu(item, row)
                        } else {
                          props.command(item)
                        }
                      })
                      el.appendChild(row)
                    })
                  }
                  return true
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (submenuEl && currentGroup && idxSub >= 0) {
                    const child = currentGroup.children[idxSub]
                    props.command(child)
                    return true
                  }
                  const item = currentItems[idxMain]
                  if (item?.type === 'group') {
                    currentGroup = item
                    idxSub = 0
                    renderSubmenu(item, el.children[idxMain])
                  } else if (item) {
                    props.command(item)
                  }
                  return true
                }
                return false
              },
              onUpdate: props => {
                if (!el) return
                closeSubmenu()
                const rect = props.clientRect?.()
                if (rect) {
                  el.style.left = `${rect.left + window.scrollX}px`
                  el.style.top = `${rect.top + window.scrollY + 22}px`
                }
                // Re-render list with updated items and maintain indices
                const items = props.items || []
                if (idxMain >= items.length) idxMain = Math.max(0, items.length - 1)
                renderList(items)
              },
              onExit: () => {
                closeSubmenu()
                if (el && el.parentNode) el.parentNode.removeChild(el)
                el = null
                // cleanup indices so next session starts clean
                currentItems = []
                idxMain = 0
                currentGroup = null
                idxSub = -1
              }
            }
          },
          command: ({ editor, range, item }) => {
            editor.chain().focus().deleteRange(range).run()
            // item can be group child or direct action
            if (item && typeof item.run === 'function') item.run()
          }
        })
      ]
    }
  })

  const extensions = [
    // Register slash command first so it always loads
    SlashCommand,
    StarterKit.configure({
      codeBlock: false,
      bulletList: { keepMarks: true, keepAttributes: true },
      orderedList: { keepMarks: true, keepAttributes: true },
      // Disable nested task-items inside bulletList to avoid UL+checkbox duplication issues
    }),
  ModShortcuts,
  ResetMarksOnEnter,
    Underline,
    Link.configure({ openOnClick: true, autolink: true }),
    Placeholder.configure({ placeholder: 'Write all additional details, notes, and extended discussion here...' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false, allowBase64: true }),
    Highlight,
  ]
  try {
    if (lowlight) extensions.push(CodeBlockLowlight.configure({ lowlight }))
  } catch {}
  try {
    extensions.push(
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    )
  } catch {}

  const initialContent = (valueJSON && typeof valueJSON === 'object') ? valueJSON : safeDoc
  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: { attributes: { class: 'rich-editor-content' } },
    onUpdate: ({ editor }) => {
      try {
        const json = editor.getJSON()
        // Persist only the rich JSON separately; do not auto-sync plain text into details
        onUpdateJSON && onUpdateJSON(json)
      } catch {}
    },
  })

  useEffect(() => {
    if (!editor) return
    if (valueJSON && typeof valueJSON === 'object') {
      try { editor.commands.setContent(valueJSON) } catch {}
    }
    // Subscribe to editor state changes to update active button styles
    const events = ['selectionUpdate','transaction','update']
    const subs = events.map(ev => (typeof editor.on === 'function' ? editor.on(ev, () => setTick(t => t+1)) : null))
    // Track quick toolbar position
    const onSel = () => {
      try {
        const state = editor.state
        const { from, to } = state.selection
        // Only show quickbar when a non-empty, non-whitespace selection exists
        if (from === to) { setQuickPos(null); return }
        const selected = editor.state.doc.textBetween(from, to, ' ')
        if (!selected || !/\S/.test(selected)) { setQuickPos(null); return }
        const dom = editor.view.domAtPos(from)
        const el = dom.node.nodeType === 1 ? dom.node : dom.node.parentElement
        if (!el || !(el instanceof HTMLElement)) { setQuickPos(null); return }
        const rect = el.getBoundingClientRect()
        // Raise the quickmenu a bit more so it doesn't cover the text
        setQuickPos({ top: rect.top + window.scrollY - 44, left: rect.left + window.scrollX - 2 })
        setQuickGroup(null)
        setQuickAnchor(null)
      } catch { setQuickPos(null) }
    }
    const offSel = editor.on('selectionUpdate', onSel)
    return () => {
      subs.forEach(s => { try { s?.off?.() } catch {} })
      try { offSel?.off?.() } catch {}
    }
  }, [editor])

  if (!editor) return null

  // Allow parent to open shortcuts modal
  useEffect(() => {
    if (!openShortcutsSignal) return
    setShowShortcuts(true)
  }, [openShortcutsSignal])

  // (removed old late-injection of SlashCommand; now registered above before useEditor)

  return (
    <div className={`rich-editor ${className||''}`}>
      <EditorContent editor={editor} />
      {!!quickPos && (
        <div className="quickmenu quickmenu-horizontal" style={{ position:'absolute', top: quickPos.top, left: quickPos.left }} onMouseDown={(e)=>e.preventDefault()}>
          {buildActionGroups(editor).map((it, idx) => {
            // Map to concise labels
            const labelMap = {
              'Headings & Blocks': 'style',
              'Lists': 'list',
              'Bold (B)': 'B',
              'Italic (I)': 'I',
              'Underline (U)': 'U',
              'Strikethrough (S)': 'S',
              'Highlight (H)': 'H',
              'Horizontal Rule (HR)': 'HR',
              'Table (2x2)': 'Table',
              'Paragraph': 'P',
            }
            const text = it.type === 'group' ? (labelMap[it.label] || it.label) : (labelMap[it.title] || it.title)
            // Active state feedback
            const isActive = (() => {
              if (!editor) return false
              if (it.type === 'group') {
                if (it.label === 'Headings & Blocks') return editor.isActive('heading') || editor.isActive('blockquote') || editor.isActive('code') || editor.isActive('codeBlock')
                if (it.label === 'Lists') return editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')
                return false
              } else {
                if (it.title.startsWith('Bold')) return editor.isActive('bold')
                if (it.title.startsWith('Italic')) return editor.isActive('italic')
                if (it.title.startsWith('Underline')) return editor.isActive('underline')
                if (it.title.startsWith('Strikethrough')) return editor.isActive('strike')
                if (it.title.startsWith('Highlight')) return editor.isActive('highlight')
                return false
              }
            })()
            return (
              <div
                key={idx}
                className={`quickmenu-item ${isActive ? 'toggled' : ''}`}
                onMouseDown={(e)=>{
                  e.preventDefault()
                  if (it.type === 'group') {
                    setQuickGroup(it)
                    // Position dropdown directly under clicked item, relative to quickmenu wrapper
                    const target = e.currentTarget
                    const left = target.offsetLeft
                    const top = target.offsetTop + target.offsetHeight
                    setQuickAnchor({ left, top })
                  } else {
                    it.run(); setQuickPos(null); setQuickGroup(null); setQuickAnchor(null)
                  }
                }}
              >{text}{it.type==='group' ? <span className="caret-down" /> : null}</div>
            )
          })}
          {quickGroup && quickAnchor && (
            <div className="quickmenu-dropdown" style={{ position:'absolute', left: quickAnchor.left, top: quickAnchor.top }}>
              {quickGroup.children.map((child, i) => {
                const toggled = typeof child.isActive === 'function' ? child.isActive() : false
                return (
                  <div key={i} className={`quickmenu-dropdown-item ${toggled ? 'toggled' : ''}`} onMouseDown={(e)=>{ e.preventDefault(); child.run(); setQuickPos(null); setQuickGroup(null); setQuickAnchor(null) }}>{child.title}</div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {showShortcuts && (
        <div className="modal-overlay" onMouseDown={()=>setShowShortcuts(false)}>
          <div className="modal" onMouseDown={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Keyboard Shortcuts</div>
              <button className="btn" onMouseDown={(e)=>{ e.preventDefault(); setShowShortcuts(false) }}>Close</button>
            </div>
            <div className="modal-body">
              <div className="muted" style={{ marginBottom:8 }}>
                Defaults are shown (Windows: Ctrl, macOS: Cmd). Exact mappings may vary by browser/environment.
              </div>
              <ul className="shortcut-list">
                <li><b>Bold</b>: Ctrl/Cmd + B</li>
                <li><b>Italic</b>: Ctrl/Cmd + I</li>
                <li><b>Underline</b>: Ctrl/Cmd + U</li>
                <li><b>Strike</b>: Ctrl/Cmd + Shift + X</li>
                <li><b>Heading 1/2/3</b>: Ctrl/Cmd + Alt + 1/2/3</li>
                <li><b>Bullet list</b>: Ctrl/Cmd + Shift + 8</li>
                <li><b>Ordered list</b>: Ctrl/Cmd + Shift + 7</li>
                <li><b>Checklist</b>: Ctrl/Cmd + Shift + 9</li>
                <li><b>Blockquote</b>: Ctrl/Cmd + Shift + B</li>
                <li><b>Code block</b>: Ctrl/Cmd + Alt + C</li>
                <li><b>Horizontal rule</b>: Ctrl/Cmd + Shift + -</li>
                <li><b>Link</b>: Ctrl/Cmd + K</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
