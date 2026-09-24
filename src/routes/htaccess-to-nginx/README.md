# htaccess ↔ Nginx 互转 · /htaccess-to-nginx

> 在线使用：<https://www.toolv.cn/htaccess-to-nginx> ・ 数据全部本地处理，不上传、不落库

同一页两个方向，顶部「方向」开关切换；「互换」把当前输出搬进输入框并换向（会摘掉上一次生成的顶部说明），
来回核对不用手动复制粘贴；下方还有一张参数速查表，点一行就把写法插进输入框。
下面按方向分组，两个方向共用的口径先列一遍。

### 两个方向共用的口径

- **逐条对应**：输出与源文件顺序一致、原注释也带过去，每条源指令对应一行（或一小块）目标配置，能逐行核对
- **不静默丢东西**：对面做不到、或语义有差的指令，就地落成 `# ⚠️ 未支持 / 需人工确认：<原文>` 加一句「该怎么改」，状态栏再汇总数量
- **拿不准就降级**：条件表达不出来时整条规则**注释掉**，而不是硬拼一个「看着对」的表达式 —— 宁可让人看一眼，也不生成改了语义的配置
- **缩进可选**：4 空格（默认，nginx 官方示例写法）/ 2 空格 / Tab，只影响产出的块内缩进（正向的 `location` / `if` 块、反向的 `<FilesMatch>` 块）
- **整页预渲染**：首屏 HTML 里就有工具条、示例与空态，利于 SEO
- **面板全屏**：两个卡片标题行各有一枚全屏按钮（原生全屏，Esc 退出）

### htaccess → nginx

- **路径前缀自动补**：.htaccess 里的 RewriteRule 模式是「相对当前目录」的（不带前导斜杠），nginx 匹配的是完整 URI —— 转换时自动补 `/` 与 `RewriteBase` 前缀，**模式和目标都补**
- **RewriteCond → if**：多个条件用 `&&`、带 `[OR]` 的用 `||`；变量做映射（`%{HTTP_HOST}` → `$host`、`%{HTTP_*}` → `$http_*`、`%{ENV:X}` → `$X`）
- **标记转换**：`[L]` → `last`、`[R=301]` → `permanent`、`[R=302]` → `redirect`、`[F]`/`[G]` → `return 403`/`410`、`[E=X:y]` → `set $X y`；`[NC]` 折成正则前置 `(?i)`（**nginx 的 rewrite 没有大小写不敏感开关**）；`[QSA]`、`[NE]` 就地写一句说明
- **重定向**：`Redirect` / `RedirectMatch` 的 301 / 302 转成前缀匹配的 `rewrite … permanent|redirect`（子路径跟着走，不丢 `/old/x` 这种深层路径）
- **容器**：`<IfModule>` 展开并注明；`<FilesMatch>` / `<Files>` / `<Location>` / `<Directory>` 转成 `location` 块，里面的指令跟着缩进

### nginx → htaccess

- **rewrite → RewriteRule**：`permanent` → `[R=301,L]`、`redirect` → `[R=302,L]`、`last` → `[L]`、没有标记就不加标记；模式里的 `(?i)` 折成 `[NC]`
- **路径前缀自动去**：nginx 的 rewrite 模式匹配「完整 URI」（带前导斜杠），.htaccess 的匹配「当前目录的相对路径」，所以模式统一去掉前导斜杠；重定向目标**保留**前导斜杠（要的正是绝对路径）。产出假设你把它放在**文档根目录**，输出顶部会写这条
- **if → RewriteCond**：`$变量` 反查成 `%{…}`、`~*` 变 `[NC]`、`=` / `!=` 自动补 `^…$` 锚点；`&&` 铺成多条 RewriteCond，全是 `||` 时除最后一条外都带 `[OR]`；文件测试 `-f` / `-d` / `-x` / `-s` / `-l` 直译（`-e` 没有对应，降级）
- **return → RewriteRule / F / G**：`3xx` 转成 `[R=码,L]`（目标里的 `$request_uri` 拆成 `$1`，原查询串交给 RewriteRule 自动带上）；`403` → `[F,L]`、`410` → `[G,L]`；`444` 与「直接返回 4xx / 5xx」没有等价写法，只给提示
- **location 分两档**：`location /` 直接展开（.htaccess 本来就作用在目录根，等价）；`location ~ 文件名正则`（正则里不含 `/`）转成 `<FilesMatch>`；前缀 / 精确 / 具名 / 带路径的正则一律降级 —— `.htaccess` 里不允许写 `<Directory>` / `<Location>`
- **try_files 给模板**：只有 `$uri` + `$uri/` + 站内兜底这一种形状会生成 `RewriteCond %{REQUEST_FILENAME} !-f` / `!-d` 加 `RewriteRule ^ <兜底> [L]`；`=404` 与具名 location 兜底只给提示
- **一对一的那批指令**：`add_header` → `Header set`（带 `always` 就是 `Header always set`）、`error_page` → `ErrorDocument`（多个状态码铺成多行）、`autoindex` → `Options ±Indexes`、`index` → `DirectoryIndex`、`charset` → `AddDefaultCharset`、`server_tokens` → `ServerSignature`、`etag off` → `FileETag None`、`gzip_types` → `AddOutputFilterByType DEFLATE`、`deny` / `allow` → `Deny from` / `Allow from`、`auth_basic` → `AuthType Basic` + `AuthName`、`auth_basic_user_file` → `AuthUserFile`、`set` → `SetEnv`
- **容器**：`server` / `http` 当作 nginx 的外壳展开（顶层不缩进）；`map` / `upstream` / `proxy_pass` / SSL / `root` / `listen` 这类 .htaccess 够不着的只标注

## 指令对照表

### htaccess → nginx

| .htaccess                                                 | nginx                                      | 说明                                                               |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `RewriteEngine On`                                        | ——                                         | nginx 没有开关，只留一行注释说明                                   |
| `RewriteEngine Off`                                       | ——                                         | 后面的 rewrite 规则按「不生效」**注释掉**（改成生效等于改语义）    |
| `RewriteBase /x/`                                         | ——                                         | 记下来，作为下面模式与目标的路径前缀                               |
| `RewriteCond …` + `RewriteRule …`                         | `if (…) { rewrite …; }`                    | 条件进 `if`，动作进 `rewrite`                                      |
| `RewriteRule ^old/(.*)$ new/$1 [R=301,L]`                 | `rewrite ^/old/(.*)$ /new/$1 permanent;`   | 补前导斜杠；`[L]` → `last`                                         |
| `Redirect 301 /old /new`                                  | `rewrite ^/old(.*)$ /new$1 permanent;`     | Apache 的 Redirect 是前缀匹配，所以带 `(.*)`                       |
| `RedirectMatch 301 ^/tag/(.*)$ /topic/$1`                 | `rewrite ^/tag/(.*)$ /topic/$1 permanent;` | 正则原样用（它本来就匹配完整路径）                                 |
| `Header set / add / append`                               | `add_header …;`                            | `always` 同步过去；`set` 与 `add_header` 的语义差只提示一次        |
| `Header unset` / `edit`                                   | ——                                         | nginx 标准模块做不到（要 headers-more 模块）                       |
| `ErrorDocument 404 /404.html`                             | `error_page 404 /404.html;`                | 目标是「文字提示」而不是路径时只给提示                             |
| `Options -Indexes` / `+Indexes`                           | `autoindex off;` / `autoindex on;`         | `±FollowSymLinks`、`-MultiViews` 注明 nginx 不需要                 |
| `DirectoryIndex a b`                                      | `index a b;`                               |                                                                    |
| `AddDefaultCharset UTF-8`                                 | `charset utf-8;`                           |                                                                    |
| `ServerSignature Off`                                     | `server_tokens off;`                       |                                                                    |
| `FileETag None`                                           | `etag off;`                                | 其它取值只给提示（nginx 不能挑字段）                               |
| `AddOutputFilterByType DEFLATE a b`                       | `gzip_types a b;`                          | 顺带提示补 `gzip on;`                                              |
| `Deny from` / `Allow from`                                | `deny …;` / `allow …;`                     | 中间的 `from` 剥掉；`Order` 因语义不同只给提示                     |
| `AuthName` / `AuthUserFile` / `Require valid-user`        | `auth_basic` / `auth_basic_user_file`      | 三条一起出现就能用；`Require user a b` 之类的只给提示              |
| `<IfModule mod_x.c>`                                      | ——                                         | 展开内容，不产块（首尾各留一行注释）；取反的 `!mod_x.c` 会额外提示 |
| `<FilesMatch>` / `<Files>` / `<Location>` / `<Directory>` | `location … { }`                           | 里面的指令跟着缩进；`<Files>` 按「路径结尾」匹配近似               |
| 其它                                                      | ——                                         | 输出 `# ⚠️ 未支持` + 原文 + 说明，不静默丢掉                       |

### nginx → htaccess

| nginx                                                       | .htaccess                                                                     | 说明                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `server { }` / `http { }`                                   | ——                                                                            | nginx 的外壳，只留一行注释，内容展开                  |
| `location / { }`                                            | ——                                                                            | 内容展开（.htaccess 本来就作用在目录根）              |
| `location ~ 文件名正则 { }`                                 | `<FilesMatch "…">`                                                            | 正则里不含 `/` 才落得过来；`~*` 用 `(?i)` 前缀表达    |
| `location 前缀 / 精确 / 具名`                               | ——                                                                            | 降级：.htaccess 里不允许 `<Directory>` / `<Location>` |
| `if (…) { rewrite … }`                                      | `RewriteCond …` + `RewriteRule …`                                             | 变量反查、`~*` → `[NC]`、`=` → `^…$`；`&&` → 多条     |
| `rewrite <模式> <目标> permanent;`                          | `RewriteRule <模式> <目标> [R=301,L]`                                         | 去掉前导斜杠；`redirect` → 302、`last` → `[L]`        |
| `return 301 <地址>;`                                        | `RewriteRule ^ <地址> [R=301,L]`                                              | 目标里的 `$request_uri` 拆成 `$1`                     |
| `return 403;` / `return 410;`                               | `RewriteRule ^ - [F,L]` / `[G,L]`                                             | Apache 的 F / G 就是这两个                            |
| `return 404;` / `return 444;`                               | ——                                                                            | Apache 没有「直接返回状态码」的指令，只给提示         |
| `add_header X Y` / `… always`                               | `Header set X Y` / `Header always set X Y`                                    | `add` 与 `set` 的语义差只提示一次                     |
| `error_page 404 /404.html`                                  | `ErrorDocument 404 /404.html`                                                 | 多个状态码铺成多行；`=状态码` 与 `@具名` 降级         |
| `autoindex on` / `off`                                      | `Options +Indexes` / `-Indexes`                                               |                                                       |
| `index a b`                                                 | `DirectoryIndex a b`                                                          |                                                       |
| `charset utf-8`                                             | `AddDefaultCharset utf-8`                                                     | `charset off` → `AddDefaultCharset Off`               |
| `server_tokens off` / `on`                                  | `ServerSignature Off` / `On`                                                  |                                                       |
| `etag off`                                                  | `FileETag None`                                                               | `etag on` 只留一句说明（Apache 默认就发）             |
| `gzip_types a b`                                            | `AddOutputFilterByType DEFLATE a b`                                           | 顺带提示要开 mod_deflate                              |
| `deny x` / `allow x`                                        | `Deny from x` / `Allow from x`                                                | `Order` 的顺序要人工确认，只提示一次                  |
| `auth_basic "realm"`                                        | `AuthType Basic` + `AuthName realm`                                           |                                                       |
| `auth_basic_user_file x`                                    | `AuthUserFile x`                                                              |                                                       |
| `set $x y`                                                  | `SetEnv x y`                                                                  | 变量作用域不同，标需人工确认                          |
| `try_files $uri $uri/ /index.php?$query_string`             | `RewriteCond %{REQUEST_FILENAME} !-f` / `!-d` + `RewriteRule ^ index.php [L]` | 只这一种形状给模板                                    |
| `map` / `upstream` / `proxy_pass` / SSL / `root` / `listen` | ——                                                                            | 输出 `# ⚠️ 未支持 / 需人工确认` + 原文 + 说明         |
| 其它                                                        | ——                                                                            | 输出 `# ⚠️ 未支持` + 原文 + 说明，不静默丢掉          |

## 提示的两个级别

| 级别         | 什么时候出现                                                                            | 输出里长什么样                                 |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `需人工确认` | 能转，但语义有差（`Order`、`R=308`、`E=`、`set`、`try_files`、`Options All`…）          | `# ⚠️ 需人工确认：<原指令>` + 一句「该怎么改」 |
| `未支持`     | 对面的标准模块做不到（正向的 `php_value`、`Header unset`；反向的 `proxy_pass`、`map`…） | `# ⚠️ 未支持：<原指令>` + 原文一并留在注释里   |

**拿不准就降级**：条件里出现对面表达不出来的东西（正向的 `%{TIME_YEAR}`、`-s`、`<` 比较；反向的
`$time_iso8601`、`==`、`-e`）时，整条规则会被注释掉而不是硬拼一个「看着对」的表达式。

**反向的 `if` 里只认 `rewrite` / `return`**：Apache 的条件只能挂在 `RewriteRule` 上，所以 `if` 里别的指令
（`add_header`、`set`、`try_files`…）一律**整条注释保留**，而不是无条件搬出来 —— 那样会悄悄放大作用范围。

## 参数速查表

写配置时查「这条指令怎么写」「这个变量对面叫什么」用。六个分组：重写与跳转 / 响应头与错误页 / 目录与索引 /
访问控制与认证 / 标记 / 变量。搜索框里 label、snippet、note 三处都能命中（`rewritecond`、`[L]`、`nosniff`、
`HTTPS` 都搜得到）。

**每行三段：名字 → 怎么写 → 干什么用的**。第三段的介绍（`note`）**行内显示**、缩进对齐到写法列 ——
只丢一个 `RewriteCond` 或 `[QSA]` 给人看，等于让人去翻官方文档，那速查表就白做了。文案口径是「这条是干什么用的 /
什么时候用得上 / 对面怎么写」。行尾是复制按钮（悬浮、键盘聚焦或触屏常显），行内主区是可点按钮。

四条口径（都在 `core/cheatsheet.ts` 的文件头，改表之前先看）：

- **只列转换器能完整转过去的写法**。`php_value`、`expires*`、独立的 `RewriteCond`、`Order`、`location /api/`
  这类会被降级成 `⚠️` 的写法不进表 —— 它们出现在输出里时自带「为什么不行 / 怎么改」，这里再列一遍只会让人插进去再撞一次墙。
- **内容跟着「方向」走**，没有独立的格式开关：表里列的就是输入框当前该写的那种格式。不给「查另一侧」的开关，
  是因为插入必须和输入框同格式 —— 把 nginx 写法插进 `.htaccess` 只会得到废配置。
- **变量组从 `VAR_MAP` / `REVERSE_VARS` 派生**，不手抄一份。于是「速查表里查得到的变量」永远等于
  「转换器认识的变量」，加一个变量只改一处（两份转换器的映射表为此从 `const` 改成 `export`）。
- **每条都强制带 `note`**（缺了被单测拦住），因为它是**行内显示**的介绍，不是 tooltip —— 介绍藏进悬浮提示等于没写。

插入方式两种，由条目自己的 `insert` 字段决定：

- **`line`（缺省）** —— 指令类条目（`RewriteRule`、`add_header`…）：另起一行插在**光标所在行的下一行**；
  光标落在空行上就写进那一行（不留多余空行）
- **`inline`** —— 标记（`[QSA]`、`permanent`）与变量：插在光标 `[start, end)` 处，它们本来就是行内片段

**为什么不照着光标位置插**：`.htaccess` 与 nginx 都是一行一条，接在行中间会拼出一条跑不起来的配置
（`RewriteBase /RewriteCond %{HTTPS} off`）。所以指令一律另起一行 —— 这条口径与「插在光标处」的摩斯 / 正则速查不同，
不要照抄那边的做法。

**版式**：`xl` 起是右侧定宽栏（`xl:w-96`，比摩斯速查的 `w-88` 宽一档 —— 这里是「名字 + 写法 + 介绍」三行，更吃宽度）；
`xl` 以下落到输入 / 输出下方的一条 **320px 定高带子**（`max-xl:h-80`），`sm` 起带子里排两列。
带子**不参与平分高度**：三块面板都 `flex-1` 会把编辑框压到不可用。

## 参数在哪调

**没有 `config.ts`**：业务参数只有默认缩进（`DEFAULT_INDENT`）、两份首屏示例（`EXAMPLE_HTACCESS` / `EXAMPLE_NGINX`）
与两个方向的变量对照表（`core/convert-htaccess.ts` 的 `VAR_MAP`、`core/convert-nginx.ts` 的 `REVERSE_VARS`）。
前三个都在 `core/types.ts` —— 没到「同一个数散在 `core/` 与 `ui/` 两边」的门槛，按 `STRUCTURE §2 B` 就地放着。
速查表的条目在 `core/cheatsheet.ts`（其中变量组从上面那两张对照表派生，不另抄一份），也不进 `config.ts`。

## 档位

**L1 + 双面板**（`+page.svelte` + `core/store.svelte.ts` + `ui/Panel.svelte` + `ui/Cheatsheet.svelte`）。
速查表是第二个 `ui/` 组件，但没引入新的状态类别（只读数据 + 一个搜索词），按 `STRUCTURE §0` 还没到 L2。
纯逻辑拆成五个模块、各自可单测：`parse-*` 只管把源码拆平（续行 / 容器 / 条件挂载），`convert-*` 只管语义映射。
两边出问题时的定位完全不同，混在一个文件里会互相干扰。模块名里的方向后缀指的是**输入格式**：
`parse-htaccess.ts` + `convert-htaccess.ts` 是正向，`parse-nginx.ts` + `convert-nginx.ts` 是反向。
`cheatsheet.ts` 两个方向共用一份，按 `Direction` 取表。

## 实现口径

- **反向是独立一套，不是「把正向倒过来跑」**：`if (…) { rewrite … }` 与 `RewriteCond` + `RewriteRule` 本来就不是一对一
  （一个 `if` 可以包多条 `rewrite`，一条 `RewriteRule` 可以挂多条 `RewriteCond`），靠解析正向的输出来反推，
  会在嵌套、注释与降级注释处塌掉。所以反向自己一套 parse + convert。
- **`if` 的条件从源文件切片取，不从 token 拼**：token 已经剥掉引号，`if ($x != "y")` 拼回去会变成 `("y")` 这种
  把右括号并进引号的怪样子。所以解析时就把 `if` 与 `{` 之间的原文切好存进 `condition`，引号与括号都保原样。
- **变量只在 `if` 条件里映射**：nginx 变量（`$host`、`$http_*`）只有落在 `if` 条件里才有对应的 `%{…}`。
  `rewrite` 的模式与目标里除了 `$1`～`$9` 反向引用之外一律降级 —— Apache 的 RewriteRule 模式只匹配路径，
  把 `%{HTTP_HOST}` 塞进模式是无效写法，硬转等于给出一条跑不起来的配置。
- **`{` / `}` 只在词首才是块分隔符**：`location ~ ^/a{2}$ {` 里的花括号属于正则本身，一律当分隔符会把它拆成两半。
- **`if` 里的非条件指令整条压成注释**：`Ctx.muted` 置上后 `push()` 统一补 `#`（已经是注释的行不叠），同时把
  `converted` 与「只提一次」的 `noted*` 标记回滚 —— 注释掉的指令不该算「转过去了」，也不该占掉提示名额。

## 已知取舍 / 暂不支持

- **反向不是正向的逆运算**：两个方向各自独立映射，不做「转过去再转回来」的对消。正向能转过去的写法反向未必转得回来 —— 这类一律降级成 `⚠️`，不猜
- **不还原 `RewriteBase`**：反向时无法知道 .htaccess 会放进哪个目录，所以模式里的前导斜杠统一去掉，并要求把结果放在**文档根目录**（输出顶部会写这条）；装在子目录里就得自己补 `RewriteBase`
- **`location` 只分两档**：`location /` 展开、`location ~ 文件名正则` 转 `<FilesMatch>`，其余只平铺并标注 —— `.htaccess` 不允许写 `<Directory>` / `<Location>`，硬凑一个容器就是在改语义
- **不展开 `RewriteCond` → `map`**：条件统一转成 `if`。nginx 社区有「if is evil」的说法，但只有把 `rewrite` / `return` 放进 `if` 才是安全的 —— 本工具生成（与接受）的正是这两种，正向输出顶部也会提一句；条件复杂时建议自己改写成 `map`
- **不做 `.htaccess` 之外的配置**：`httpd.conf` / `<VirtualHost>` 里的指令不在范围内，反向也一样（`root` / `listen` / SSL 只标注）
- **不生成外壳**：正向不生成 `server { }`，反向不生成 `<IfModule mod_rewrite.c>` —— 输出都是「可直接粘进去」的裸指令，只在顶部提一句
- **提示明细只在输出里**：不另开「待处理清单」面板 —— 输出与源文件逐条对应，`⚠️` 就地标着比列表更好定位（状态栏给数量）
- **不猜上游**：正向的 `[P]`、反向的 `proxy_pass` 都只提示「要用 proxy_pass + upstream / ProxyPass」，不会替你编一个 upstream 块
- **反向的 `if` 里只认 `rewrite` / `return`**：Apache 的条件只能挂在 `RewriteRule` 上，`if` 里其它指令（`add_header` / `set` / `try_files`…）带不上条件，一律整条注释保留 —— 无条件搬出来会悄悄放大作用范围

## 验证过什么

- 五份单测共 118 个用例：`core/parse-htaccess.test.ts` 13、`core/convert-htaccess.test.ts` 26、
  `core/parse-nginx.test.ts` 13、`core/convert-nginx.test.ts` 46、`core/cheatsheet.test.ts` 20
- 正向覆盖：续行合并、行内 `#` 不当注释、正则里的 `\.` 不被吃掉、条件挂载与「条件后面没有规则」、补前缀与 `RewriteBase`、
  `[L]` / `[R=301]` / `[R=302]` / `[F]` / `[G]` / `[QSA]` / `[NC]`、`RewriteEngine Off` 注释、条件表达不出来时整条降级、
  `Redirect` 前缀匹配、`RedirectMatch` 原样正则、`Header` / `ErrorDocument` / `Options` / `Deny from` 等逐条映射、容器缩进与三档缩进
- 反向覆盖：token 切分（引号里的 `#`、词中间的花括号、正则转义）、跨行指令、容器路径与 `if` 条件切片、
  `rewrite` 四个标记与 `(?i)`、模式 / 目标去前导斜杠与 `$request_uri` 拆 `$1`、`&&` / `||` 铺 RewriteCond、
  文件测试与 `=` / `!=` / 纯变量条件、认不出的变量与嵌套 `if` 整条降级、`return` 的 3xx / 403 / 410 / 444 / 404、
  `add_header` / `error_page` / `autoindex` / `index` / `charset` / `server_tokens` / `etag` / `gzip_types` / `deny` /
  `auth_basic` / `set` / `try_files` 逐条映射、`location` 四类降级与 `<FilesMatch>` 里的 rewrite 拦截、三档缩进
- 速查表覆盖：两套表随方向切换、变量组与 `VAR_MAP` / `REVERSE_VARS` 条数对齐、id 不重复、每条都有非空 `note`、
  标记与变量是 inline、
  筛选（label / snippet / note 三处命中、大小写不敏感、空组不返回）、插入（inline 插光标处并替换选区；
  line 插到下一行 / 空行就地写 / 末行追加 / 多行片段整块插 / 忽略选区）、右列预览只取前两行
