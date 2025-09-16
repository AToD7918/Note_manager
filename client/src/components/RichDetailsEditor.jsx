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

// Initialize lowlight defensively to avoid crashing the editor on env differences
let lowlight
try {
  lowlight = createLowlight()
  try { lowlight.registerLanguage('javascript', jsLang) } catch {}
  try { lowlight.registerLanguage('python', pyLang) } catch {}
} catch {
  lowlight = undefined
}

export default function RichDetailsEditor({ valueJSON, onUpdateJSON, onUpdatePlain, className }) {
  const [tick, setTick] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
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

  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      bulletList: { keepMarks: true, keepAttributes: true },
      orderedList: { keepMarks: true, keepAttributes: true },
      // Disable nested task-items inside bulletList to avoid UL+checkbox duplication issues
    }),
    ModShortcuts,
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
        const text = editor.getText()
        onUpdateJSON && onUpdateJSON(json)
        onUpdatePlain && onUpdatePlain(text)
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
    return () => {
      subs.forEach(s => { try { s?.off?.() } catch {} })
    }
  }, [editor])

  if (!editor) return null

  const ToolButton = ({ onTrigger, label, active=false }) => (
    <button
      className={`btn ${active ? 'toggled' : ''}`}
      type="button"
      onMouseDown={(e)=>{ e.preventDefault(); onTrigger && onTrigger() }}
    >{label}</button>
  )

  return (
    <div className={`rich-editor ${className||''}`}>
      <div className="rich-toolbar">
        <ToolButton label="H1" active={editor.isActive('heading', { level: 1 })} onTrigger={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolButton label="H2" active={editor.isActive('heading', { level: 2 })} onTrigger={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolButton label="H3" active={editor.isActive('heading', { level: 3 })} onTrigger={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolButton label="B" active={editor.isActive('bold')} onTrigger={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton label="I" active={editor.isActive('italic')} onTrigger={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton label="U" active={editor.isActive('underline')} onTrigger={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolButton label="S" active={editor.isActive('strike')} onTrigger={() => editor.chain().focus().toggleStrike().run()} />
  <ToolButton label="Code" active={editor.isActive('code')} onTrigger={() => editor.chain().focus().toggleCode().run()} />
  <ToolButton label="Quote" active={editor.isActive('blockquote')} onTrigger={() => editor.chain().focus().toggleBlockquote().run()} />
  <ToolButton label="Highlight" active={editor.isActive('highlight')} onTrigger={() => editor.chain().focus().toggleHighlight().run()} />
        <ToolButton label="HR" onTrigger={() => editor.chain().focus().setHorizontalRule().run()} />
        <ToolButton label="UL" active={editor.isActive('bulletList')} onTrigger={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton label="OL" active={editor.isActive('orderedList')} onTrigger={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="Task" active={editor.isActive('taskList')} onTrigger={() => editor.chain().focus().toggleTaskList().run()} />
        <ToolButton label="CodeBlock" active={editor.isActive('codeBlock')} onTrigger={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolButton label="Table" onTrigger={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()} />
        <ToolButton label="Clear" onTrigger={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
        <div style={{ flex:1 }} />
        <ToolButton label="Shortcuts" onTrigger={()=>setShowShortcuts(true)} />
      </div>
      <EditorContent editor={editor} />
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
