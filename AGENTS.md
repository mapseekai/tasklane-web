# 项目代理说明

## OINK build baseline

This site uses OINK v1.4.0 and is validated with Hugo Extended 0.169.0.
Keep CI and local builds on this baseline. Do not enable `--panicOnWarning`
or `HUGO_PANICONWARNING`; keep warnings visible and review them. The upstream
LibSass deprecation warning is accepted. No external Sass compiler is required.

## Git 内容与大文件规则

用户于 2026-10-10 明确的通用仓库规则：

- 仓库默认保存源代码、配置和必要的轻量文档、元数据。构建产物、可执行文件、软件包、容器/虚拟机镜像、下载压缩包、数据库导出和大体积原始数据默认不进入 Git；文本格式的数据大文件同样需要检查。
- 在工作树内下载或生成上述文件之前，先选择仓库外的制品/数据位置，或补上合理的 `.gitignore` 规则并验证实际路径已被忽略，防止暂存和代理恢复/差异快照将它们写入 Git 对象库。
- 暂存、提交前检查新增文件的大小、类型和 staged 文件列表，只加入本次需要的源文件；不得用强制添加绕过忽略规则。优先保留来源清单、校验值及可复现的下载/构建方法。
- 对二进制素材、数据集或生成文件是否应纳入版本控制拿不准时，先问用户，再暂存或提交；确需例外时也先取得用户明确指示。
- 本规则不授权删除已有文件、stash、恢复快照或改写 Git 历史。忽略规则不会清除已存在的 Git 对象，历史清理需要单独明确范围。

## tasklane-web content and validation

- This is the independent tasklane documentation website. Runtime implementation lives in the tasklane repository; do not modify it as a website side effect.
- Keep Chinese prose with English API names and Home / Docs / Blog navigation.
- Keep tutorials, how-to guides, reference and explanation distinct. Use the project-local documentation-writer classification and developer-docs-structure-audit navigation methods. Load technical-writing for new repository prose.
- Ground behavior in the snapshot recorded by data/upstream.json. Keep API snapshots under assets/reference, outside Hugo's data directory.
- Read tutorial snippets from examples via shortcodes; run pnpm check after content or template changes. The link checker self-test is python3 scripts/check-site.py --self-test.
- Use OINK module overrides, CSS tokens and existing local assets. Preserve keyboard focus, reduced-motion support, no-script prose and both color modes.
- Use ego-browser for AI browser verification. Do not use Puppeteer or Playwright as an alternative browser executor.
- Do not create a remote repository, publish, or alter unrelated runtime source unless explicitly requested.
