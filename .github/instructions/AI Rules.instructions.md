---
applyTo: '**'
---


## General Software Development Process Guidelines

### 1. Code Preservation & Modification
-  **Modify established code patterns only with explicit approval**  
-  **Maintain architectural consistency**  
  - Preserve proven design patterns (MVC, MVVM, Clean Architecture)
-  **Follow naming conventions and directory structures**  
  - Verify component existence before creating new entities
  - Apply consistent naming rules:
    ```generic
    // Primary components: ComponentName.extension
    // Protocol implementations: Component+Protocol.extension
    ```

### 2. Context Awareness
-  **Consult project documentation before modifications**  
-  **Adhere to platform-agnostic standards**  
-  **Implement internationalization (i18n)**  
  - Maintain/improve localization structures [^1] [^2]
-  **Preserve design system integrity**  
  - Ensure consistent color management and UI components

### 3. Self-Verification Protocol
-  **Verify data layer compatibility**  
-  **Validate accessibility features**  
-  **Maintain UI/UX pattern compliance**  
-  **Cross-reference with reference architectures**

### 4. Iterative Implementation
-  **Decompose features into phased implementations**  
-  **Obtain step-by-step approvals**  
-  **Document all changes**  
  - Implement code changes only after confirmation

### 5. Documentation Standards
-  **Clearly justify modifications**  
-  **Identify affected components**  
-  **Provide style-consistent code examples**  
-  **Document system integration impacts**

### 6. Quality Assurance
-  **Require approvals for architectural changes**  
-  **Ensure backward compatibility**  
-  **Consider user configurations**  
-  **Implement CI/CD pipelines**  
-  **Follow version control workflows**  
  - Adhere to branching/merging strategies [^3]
### 7 Main RULE 
- Read all relevant data and get an overview.
- Conduct a detailed error analysis.
- Create a work structure step by step.
- Work through it then step by step.
- Check your actions after each step and look for possible errors.
- Do not create any new files.
---

