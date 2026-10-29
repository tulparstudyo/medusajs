import "./index.css"

export default function HtmlContentView({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
