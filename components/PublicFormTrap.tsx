// Hidden from people, keyboard navigation, and assistive technology.
export function PublicFormTrap() {
  return <div hidden aria-hidden="true">
    <label>Leave this field empty<input name="website_url" type="text" tabIndex={-1} autoComplete="off" /></label>
  </div>;
}
