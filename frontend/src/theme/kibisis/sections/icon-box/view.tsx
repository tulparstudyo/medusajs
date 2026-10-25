import "./index.css"

export default function IconBoxView({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
