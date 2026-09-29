import { TransitionLink } from '@/components/navigation/TransitionLink'

export default function NotFound() {
  return (
    <div className="page page--editorial page--lost">
      <p className="ch__index mono">
        <span>404</span> Signal lost
      </p>
      <h1 className="title title--hero">Lost in space</h1>
      <p className="lead">This coordinate doesn&apos;t exist in the Milky Way. Yet.</p>
      <TransitionLink href="/" label="The Journey" className="go go--ion" cursor="enter">
        Return to the journey <span className="go__arrow">→</span>
      </TransitionLink>
    </div>
  )
}
