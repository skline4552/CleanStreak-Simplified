# Contributing to CleanStreak Simplified

## Branching Strategy

We use **GitHub Flow** for this project - a simple, effective workflow perfect for continuous development.

### Branch Types

- **`main`** - Production-ready code. Always deployable.
- **Feature branches** - New features and enhancements
- **Bug fix branches** - Fixes for existing issues

### Branch Naming Convention

Use descriptive names with prefixes:

- `feature/task-categories` - New features
- `enhancement/mobile-ui` - Improvements to existing features
- `fix/streak-calculation` - Bug fixes
- `docs/setup-instructions` - Documentation updates

### Workflow Steps

1. **Create branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Develop your feature**
   - Make focused commits with clear messages
   - Test your changes locally
   - Keep the single-file structure intact

3. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Go to GitHub and create a Pull Request
   - Fill out the PR template completely
   - Request review if working with others

4. **Merge and cleanup**
   - Merge PR after approval
   - Delete the feature branch
   - Pull latest main for next feature

### Commit Message Format

```
Brief description of change (50 chars or less)

Optional longer explanation of what and why, not how.
Focus on the motivation for the change.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Code Standards

- Maintain the single HTML file structure
- Keep mobile-first responsive design
- Preserve the 50-task rotation system
- Test on both desktop and mobile
- Follow existing code style and patterns

### Example Complete Workflow

```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/dark-mode

# Make changes, test locally
# ... development work ...

# Commit with good message
git add .
git commit -m "Add dark mode toggle with system preference detection"

# Push and create PR
git push origin feature/dark-mode
# Create PR on GitHub using the template

# After PR approval and merge
git checkout main
git pull origin main
git branch -d feature/dark-mode
```

This workflow keeps the codebase clean, enables easy collaboration, and maintains a clear history of changes.