
export const maxFileLines = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum file line count (default: 200)',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1 },
          skipBlankLines: { type: 'boolean' },
          skipComments: { type: 'boolean' },
          skipImports: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyLines:
        'File has too many lines ({{count}}). Maximum allowed is {{max}} lines. Please split this file into smaller, more focused modules with single responsibilities. Consider extracting utility functions, separating components, or moving complex logic into dedicated files.',
    },
  },
  create(context) {
    // Get rule options with defaults
    const options = {
      max: 200,
      skipBlankLines: true,
      skipComments: true,
      skipImports: true,
      ...context.options[0],
    }
    const maxLines = options.max
    const skipBlankLines = options.skipBlankLines !== false
    const skipComments = options.skipComments !== false
    const skipImports = options.skipImports !== false

    return {
      Program(node) {
        const lines = context.sourceCode.lines || context.sourceCode.text.split(/\r?\n/)

        // Count non-empty, non-comment lines
        let codeLineCount = 0
        const comments = context.sourceCode.getAllComments()
        const commentLines = new Set()
        const importLines = new Set()

        // Mark all comment lines if we're skipping them
        if (skipComments) {
          comments.forEach(comment => {
            const startLine = comment.loc.start.line
            const endLine = comment.loc.end.line

            for (let i = startLine; i <= endLine; i++) {
              commentLines.add(i)
            }
          })
        }

        // Mark all import lines if we're skipping them
        if (skipImports) {
          context.sourceCode.ast.body.forEach(statement => {
            if (
              statement.type === 'ImportDeclaration' ||
              (statement.type === 'ExpressionStatement' &&
                statement.expression.type === 'CallExpression' &&
                statement.expression.callee.name === 'require')
            ) {
              const startLine = statement.loc.start.line
              const endLine = statement.loc.end.line

              for (let i = startLine; i <= endLine; i++) {
                importLines.add(i)
              }
            }
          })
        }

        // Count actual code lines
        for (let i = 0; i < lines.length; i++) {
          const lineNumber = i + 1
          const line = lines[i].trim()

          // Skip blank lines if configured to do so
          if (skipBlankLines && line.length === 0) {
            continue
          }

          // Skip comment lines if configured to do so
          if (skipComments && commentLines.has(lineNumber)) {
            continue
          }

          // Skip import lines if configured to do so
          if (skipImports && importLines.has(lineNumber)) {
            continue
          }

          codeLineCount++
        }

        if (codeLineCount > maxLines) {
          context.report({
            node,
            messageId: 'tooManyLines',
            data: {
              count: codeLineCount,
              max: maxLines,
            },
          })
        }
      },
    }
  },
}

/**
 * Plugin object with our custom rules
 */
export const customRules = {
  rules: {
    'max-file-lines': maxFileLines,
  },
}