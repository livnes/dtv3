# CSS Structure Documentation

## 📁 Tailwind 4 CSS Architecture for Next.js

> **References:** 
> - [Tailwind CSS Next.js Installation Guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
> - [Tailwind CSS Functions and Directives](https://tailwindcss.com/docs/functions-and-directives#reference-directive)
> - [Tailwind CSS PostCSS Installation](https://tailwindcss.com/docs/installation/using-postcss)

```
app/styles/
├── globals.css              # Main entry point – imports all modules in the correct order
├── base.css                 # Base styles, global rules, CSS variables, Tailwind directives
├── layout.css               # Layout components (sidebar, main-content, headers)
├── ui/  
│   ├── buttons.css          # All button variants using @apply      
│   ├── cta.css              # Call-to-action styles
└── components/
    ├── cards.css            # Card components with Tailwind utilities
    ├── forms.css            # Form controls using @apply
    ├── profile.css          # Profile-page-specific components
    └── utilities.css        # Flash messages, loading states, utilities
```

---

## 🚨 **CRITICAL: @reference Directive Required**

### **⚠️ MUST ADD to EVERY Component CSS File:**

**Every CSS file that uses `@apply` MUST start with:**

```css
@reference "tailwindcss";

@layer components {
  /* Your component styles here */
}
```

**Why:** According to [Tailwind's @reference documentation](https://tailwindcss.com/docs/functions-and-directives#reference-directive), when using `@apply` in separate CSS files, you need to import utilities for reference without duplicating CSS output.

**Without `@reference`:** ❌ `Error: Cannot apply unknown utility class 'bg-white'`  
**With `@reference`:** ✅ All Tailwind utilities work in `@apply`

---

## 🔧 Required Setup (Tailwind 4)

### **1. Package Installation**
```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

### **2. PostCSS Configuration**
```js
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### **3. Tailwind Configuration**
```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}
```

### **4. Main CSS File Structure**
```css
/* app/styles/globals.css */

/* 1. Tailwind's base reset & preflight */
@tailwind base;

/* 2. Your custom base layer (CSS variables, global resets) */
@import './base.css';

/* 3. Tailwind's component layer */
@tailwind components;

/* 4. Your custom component files */
@import './layout.css';
@import './ui/buttons.css';
@import './ui/cta.css';
@import './components/cards.css';
@import './components/forms.css';
@import './components/profile.css';
@import './components/utilities.css';

/* 5. Tailwind's utility layer */
@tailwind utilities;
```

---

## 📋 Component File Template

**EVERY component CSS file must follow this exact structure:**

```css
/* app/styles/components/example.css */
@reference "tailwindcss";

@layer components {
  .my-component {
    @apply bg-white border border-gray-200 rounded-lg p-4;
  }
  
  .my-component:hover {
    @apply shadow-md;
  }
}
```

### **✅ DO:**
- Always start with `@reference "tailwindcss";`
- Use `@layer components { ... }`
- Only use actual Tailwind utility classes in `@apply`
- Use semantic class names (`.btn-primary`, `.card-header`)

### **❌ DON'T:**
- Use custom utilities that don't exist (`bg-background-secondary`)
- Forget the `@reference` directive
- Use `@layer utilities` in component files
- Write raw CSS properties (use `@apply` instead)
- **Use custom component classes in `@apply`** (e.g., `@apply btn-secondary` ❌)

---

## 🎯 Benefits of This Structure

### ✅ **Best of Both Worlds**
* **Semantic class names** (`.btn-primary`, `.profile-container`) keep HTML readable.
* **Tailwind utilities under the hood** with `@apply` – no manual CSS for spacing, colors, or flex/grid.
* **Full Tailwind ecosystem** (responsive prefixes, theming, plugins).
* **Easy to maintain and extend**: change a design token once in your Tailwind config, and all components update automatically.

### ✅ **Tailwind-Powered Components**
```css
@reference "tailwindcss";

@layer components {
  .btn-primary {
    @apply inline-flex items-center gap-2 px-6 py-3 rounded-lg
           font-medium text-white bg-blue-500 transition-all
           hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-md;
  }
}
```

### ✅ **Maintainability**
* Semantic component names are self-documenting.
* Tailwind utilities for consistent spacing, typography, and colors.
* Easy to customize via `tailwind.config.js`.
* Responsive design built-in (use `sm:`, `md:`, `lg:` prefixes in `@apply`).

### ✅ **Performance**
* Tailwind's optimization removes unused styles (tree-shaking).
* `@reference` prevents CSS duplication.
* Smaller final CSS bundle.
* Better caching and faster load times.

---

## 🚀 Adding New Components

**Follow these steps EXACTLY:**

1. **Create the file:**
   `app/styles/components/[component-name].css`

2. **Use the template:**
   ```css
   @reference "tailwindcss";
   
   @layer components {
     .component-name {
       @apply /* Tailwind utilities here */;
     }
   }
   ```

3. **Use only real Tailwind utilities:**
   * ✅ `bg-white`, `text-gray-800`, `border-gray-200`
   * ❌ `bg-background`, `text-text-primary`, `border-border`

4. **Import in globals.css:**
   ```css
   @import './components/[component-name].css';
   ```

5. **Verify the import order** in `globals.css`:
   - Base layer imports come first
   - Component imports come after `@tailwind components;`
   - Before `@tailwind utilities;`

---

## 🔍 Troubleshooting

### **Error: "Cannot apply unknown utility class"**
**Causes:** 
1. Missing `@reference "tailwindcss";` at the top of your CSS file
2. Trying to use custom component classes in `@apply` (e.g., `@apply btn-secondary`)
**Fixes:** 
1. Add the `@reference` directive to every file using `@apply`
2. Only use actual Tailwind utilities in `@apply` - copy the utilities from the component class instead

### **Error: "Unexpected token"**
**Cause:** Syntax error in CSS file (missing `;`, `}`, or `*/`).  
**Fix:** Check file syntax, especially comment blocks.

### **No styles appearing**
**Cause:** Missing Tailwind config or incorrect PostCSS setup.  
**Fix:** Ensure `tailwind.config.js` and `postcss.config.mjs` exist with correct content paths.

### **CSS not loading**
**Cause:** Import order wrong in `globals.css`.  
**Fix:** Follow the exact order: base → components → utilities.

---

## 🌟 Key Advantages

1. **Readable:** Semantic class names like `.btn-primary`.
2. **Powerful:** Full Tailwind utility system underneath every component.
3. **Consistent:** Design tokens come from your centralized `tailwind.config.js`.
4. **Responsive:** Built-in responsive prefixes (`sm:`, `md:`, `lg:`), so no manual `@media` blocks.
5. **Maintainable:** One source of truth for colors, spacing, breakpoints, and plugins.
6. **Performant:** Tailwind's purge/optimization removes unused CSS, resulting in smaller bundles.
7. **Modular:** Clean file organization with proper imports.

---

## 📚 Reference Links

- [Tailwind CSS Next.js Installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Tailwind @reference Directive](https://tailwindcss.com/docs/functions-and-directives#reference-directive)
- [Tailwind @apply Directive](https://tailwindcss.com/docs/functions-and-directives#apply-directive)
- [Tailwind PostCSS Installation](https://tailwindcss.com/docs/installation/using-postcss)

---

## ✅ Checklist for New CSS Files

- [ ] File starts with `@reference "tailwindcss";`
- [ ] Uses `@layer components { ... }`
- [ ] Only uses real Tailwind utilities in `@apply`
- [ ] Added to import list in `globals.css`
- [ ] No custom utilities that don't exist
- [ ] Proper syntax (no missing braces or semicolons)
