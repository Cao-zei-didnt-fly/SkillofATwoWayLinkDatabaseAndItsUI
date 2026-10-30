from pathlib import Path
from xml.sax.saxutils import escape
import hashlib

from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Flowable
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output' / 'pdf' / 'Link-Garden-0.5.0-安装与接入教程.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('YaHei', 'C:/Windows/Fonts/msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('YaHeiBold', 'C:/Windows/Fonts/msyhbd.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('Mono', 'C:/Windows/Fonts/consola.ttf'))
pdfmetrics.registerFontFamily('YaHei', normal='YaHei', bold='YaHeiBold', italic='YaHei', boldItalic='YaHeiBold')

GREEN = colors.HexColor('#246451')
INK = colors.HexColor('#253c35')
MUTED = colors.HexColor('#6c7e73')
LIGHT = colors.HexColor('#edf3ed')
LINE = colors.HexColor('#d8e2d8')
WIDTH, HEIGHT = A4
CW = WIDTH - 88

styles = {
    'body': ParagraphStyle('body', fontName='YaHei', fontSize=10, leading=16.2, textColor=INK, wordWrap='CJK', spaceAfter=7),
    'small': ParagraphStyle('small', fontName='YaHei', fontSize=8.4, leading=13, textColor=MUTED, wordWrap='CJK', spaceAfter=5),
    'title': ParagraphStyle('title', fontName='YaHeiBold', fontSize=28, leading=36, textColor=INK, spaceAfter=12),
    'h1': ParagraphStyle('h1', fontName='YaHeiBold', fontSize=21, leading=29, textColor=INK, spaceAfter=13),
    'h2': ParagraphStyle('h2', fontName='YaHeiBold', fontSize=12, leading=19, textColor=GREEN, spaceBefore=10, spaceAfter=6),
    'cell': ParagraphStyle('cell', fontName='YaHei', fontSize=8.8, leading=14, textColor=INK, wordWrap='CJK'),
    'head': ParagraphStyle('head', fontName='YaHeiBold', fontSize=9, leading=14, textColor=colors.white, wordWrap='CJK'),
    'code': ParagraphStyle('code', fontName='Mono', fontSize=8.5, leading=13, textColor=INK, splitLongWords=True, spaceAfter=6),
    'codecn': ParagraphStyle('codecn', fontName='YaHei', fontSize=9.5, leading=15.5, textColor=INK, wordWrap='CJK', spaceAfter=6),
    'badge': ParagraphStyle('badge', fontName='YaHeiBold', fontSize=9, leading=14, textColor=GREEN, spaceAfter=10),
}

story = []
def p(text, style='body'):
    return Paragraph(text, styles[style])
def add(text, style='body'):
    story.append(p(text, style))
def h(text):
    add(text, 'h2')
def gap(height=7):
    story.append(Spacer(1, height))
def title(number, text, subtitle):
    add(f'0{number} / 安装与使用', 'badge')
    add(text, 'h1')
    add(subtitle, 'small')
    gap(5)
def note(text):
    box = Table([[p(text)]], colWidths=[CW])
    box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.6,LINE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.append(box)
    gap(7)
def table(headers, rows, widths):
    content = [[p(x, 'head') for x in headers]] + [[p(str(x), 'cell') for x in row] for row in rows]
    result = Table(content, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f5f7f3')]),('LINEBELOW',(0,0),(-1,0),.6,GREEN),('LINEBELOW',(0,1),(-1,-1),.4,LINE),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.append(result)
    gap(6)
def step(number, heading, body):
    story.append(KeepTogether([p(f'{number:02d}　{heading}', 'h2'),p(body)]))
def code(lines):
    text='<br/>'.join(escape(line).replace(' ', '&nbsp;') for line in lines)
    style='codecn' if any(ord(c)>127 for line in lines for c in line) else 'code'
    result=Table([[p(text,style)]],colWidths=[CW])
    result.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    story.append(result)
    gap(7)
def newpage():
    story.append(PageBreak())

class InstallRoute(Flowable):
    def __init__(self):
        Flowable.__init__(self)
        self.width=CW
        self.height=64
    def draw(self):
        c=self.canv
        labels=['运行安装包','选择目录','必做注册说明','Agent 全局接入']
        w=(CW-3*17)/4
        for i,label in enumerate(labels):
            x=i*(w+17)
            c.setFillColor(LIGHT);c.setStrokeColor(LINE);c.roundRect(x,12,w,38,7,fill=1,stroke=1)
            c.setFont('YaHeiBold',10);c.setFillColor(GREEN);c.drawCentredString(x+w/2,27,label)
            if i<3:
                c.setStrokeColor(MUTED);c.line(x+w+4,31,x+w+13,31);c.line(x+w+10,34,x+w+13,31);c.line(x+w+10,28,x+w+13,31)

# Page 1
add('LINK GARDEN  /  WINDOWS DESKTOP', 'badge')
add('安装与接入教程', 'title')
add('版本 0.5.0　|　Windows 10 / 11 x64　|　2026-10-30', 'small')
add('从安装桌面程序，到让你的 AI 搜索和维护 Markdown 知识库。无需编程，也无需另外安装 Node.js。')
gap(6)
story.append(InstallRoute())
h('安装前，确认这三件事')
table(['项目','说明'],[
    ['电脑系统','Windows 10 或 Windows 11，64 位（x64）。不适用于 Windows 7/8 或 32 位系统。'],
    ['要运行的文件','<b>Link-Garden-Setup-0.5.0.exe</b>，约 118 MB。这是完整安装包。'],
    ['Agent 客户端','先安装要使用的 Agent；安装器只准备说明，必须再由 Agent 在用户级全局注册并核验信任。没有 agent 也可使用笔记 UI。'],
],[91,CW-91])
step(1,'运行完整安装包','双击 <b>Link-Garden-Setup-0.5.0.exe</b>，按向导继续。如果只拿到一个“Link Garden.exe”，请先确认它是否属于免安装版；免安装版需要保留整个 win-unpacked 目录。')
step(2,'选择安装目录','默认优先 <b>D:\Link Garden</b>；没有 D 盘时使用 <b>C:\Link Garden</b>。也可自行选择可写目录。笔记、缓存和日志均放在安装目录的 data 内。')
step(3,'确认必做的全局注册步骤','安装页会固定勾选“Agent 全局注册 / 核验 MCP，并完成客户端信任授权”。安装器仅生成指南，不再默认代写 Agent 配置。安装后必须把指令交给目标 Agent。')
gap(6)
note('<b>兼容性说明：</b>本包面向 Windows 10/11 x64；已在 Windows 11 验证，Windows 10 尚未完成实机测试。程序不设置开机自启动，也不驻留托盘。')

# Page 2
newpage();title(2,'必做：Agent 全局注册','全局指当前用户的所有项目，不是所有 Windows 账户。七个平台均需完成此步骤。')
table(['接入项','用户级全局接入','需要知道'],[
    ['Codex','由 Agent 注册 MCP 与本地 skill。','重载 MCP 或新开会话后确认工具可用。'],
    ['WorkBuddy','用户级 MCP；核验信任与工具开关。','不修改 CodeBuddy 配置，信任可能仍需用户确认。'],
    ['CodeBuddy','使用 --scope user 注册；核对全局配置。','独立的 .codebuddy 目录，可通过 /mcp 检查权限。'],
    ['Cursor','本地全局 MCP；使用本地 skill。','云端或远程会话需要单独配置。'],
    ['Claude Desktop','本地 Desktop MCP。','不等同于云端连接器或 Cowork；使用说明由 MCP 提供。'],
    ['VS Code / Copilot','默认本地用户 Profile 的 MCP。','自定义 Profile、Insiders 和远程环境请用注册指南。'],
    ['Cline（VS Code）','已存在的默认扩展 MCP 配置。','未生成该配置文件时跳过；其他宿主使用注册指南。'],
],[102,175,CW-277])
h('安装器准备，Agent 完成接入')
add('安装器生成本机专用 REGISTER-MCP.md，提供程序、知识库、skill 和各平台的全局接入位置。它不再默认改写 Agent 配置。')
add('由 Agent 读取指南，通过客户端原生接口或局部合并全局配置完成注册。已有同名条目先核对，保留其他设置；0.3 预写过配置也必须核验。')
step(4,'等待安装与指南生成','安装器复制程序并生成必做指南。首次打开大库时仍可能需要建立索引；不需要另外启动服务器。')
step(5,'从桌面启动 Link Garden','安装完成后，双击桌面或开始菜单中的 <b>Link Garden</b>。正常安装不要求你运行终端命令。')
note('<b>全局注册 ≠ 已获客户端信任。</b>需要用户在 WorkBuddy / CodeBuddy 等客户端确认授权时，仍须正常确认。不得通过关闭沙箱或伪造信任来解决；只有实际调用成功才能确认接入。')

# Page 3
newpage();title(3,'安装后检查、修复关联','所有接入管理操作都在应用右上角的“连接 AI”中。')
step(1,'打开“连接 AI”','查看客户端列表、配置路径与提示。如果刚安装或启动过某个 agent，先点击 <b>重新检测</b>。显示“发现配置目录”不代表客户端当前正在运行。')
step(2,'复制必做的全局注册指令','选择目标客户端，点击 <b>复制所选全局注册指令</b>，或向下找到 <b>复制必做的全局注册指令</b>。粘贴给该 Agent，让它按用户级全局方式注册或核验已有条目。')
step(3,'在客户端核验信任与实际调用','让 Agent 分别报告全局配置路径、信任状态、握手结果和只读调用结果。应用的 <b>独立诊断（不代表已信任）</b> 只验证本程序能运行，不能代替对方客户端授权。')
table(['界面状态','下一步'],[
    ['可关联','仍需把必做指令交给 Agent；不代表已完成全局注册。'],
    ['已预写 / 已存在','核对用户级全局配置，再在客户端核验信任、重载并执行只读调用。'],
    ['需要修复 / 技能需检查','安装路径变动或技能缺失时可修复；用户手改内容可能需要自行处理。'],
    ['未检测到','先安装、启动客户端并重新检测；仍未发现时使用注册指南。'],
    ['配置冲突 / 配置需检查','保留现有配置；先检查同名服务、文件格式或用户修改，再处理。'],
],[141,CW-141])
h('用一句只读指令确认 Agent 能用')
note('请使用 Link Garden，列出知识库已有的分类和标签，再搜索“<b>双向链接</b>”，返回笔记标题和原文命中片段。先不要创建或修改笔记。')
add('如果工具已加载，agent 应能先查询，再根据命中片段决定是否读取正文。它不必预先知道精确标签，也不需要一次读完整个库。', 'small')
h('只想取消某个平台的关联？')
add('<b>解除本产品关联</b> 用于清理旧版受管理的预写记录。0.4 由 Agent 直接注册的条目，需要在对应客户端移除；其他服务和笔记保留。')

# Page 4
newpage();title(4,'全局注册与信任：执行步骤','所有客户端都必须执行；未列出的客户端和自定义 Profile 也通过这份指南处理。')
step(1,'找到“必做：Agent 自行全局注册与信任核验”','打开“连接 AI”，向下滚动到该区域。页面会显示本机生成的 <b>REGISTER-MCP.md</b> 的完整路径。')
step(2,'复制给 Agent 的指令','点击 <b>复制必做的全局注册指令</b>，粘贴到你希望接入的 agent 对话中。这段指令已经包含本机文件路径，不要换成别人的路径。')
note('请读取本机文件 [应用显示的 REGISTER-MCP.md 完整路径]，必须在当前客户端的用户级全局注册或核验 Link Garden。保留其他配置，检查客户端信任并实际只读调用工具，分别报告各个状态；需要我授权时准确指出位置。')
step(3,'让 Agent 读取说明并局部注册','指南包含完整 stdio 配置。必须选 user/global，不能只写当前工作区。CodeBuddy 优先使用原生 --scope user 接口；WorkBuddy 需核对安全中心的 MCP 总开关、服务与工具开关。')
step(4,'重载并执行只读验证','在客户端完成必要的信任/授权后，确认工具列表中出现 <b>search_notes</b>、<b>read_note</b>、<b>catalog</b>。再使用上一页的只读指令验证。')
h('默认生成位置')
code([r'D:\Link Garden\data\integrations\REGISTER-MCP.md'])
add('默认 D 盘；无 D 盘则换为 C 盘。自定义安装时使用实际安装目录。“连接 AI”显示完整指南路径。', 'small')
h('手动配置时保留这三项')
table(['项目','原因'],[
    ['command 与 args','指定已安装程序及打包内的 MCP 入口；不要只复制 exe 文件。'],
    ['ELECTRON_RUN_AS_NODE=1','使用程序自带运行时执行 MCP；不需要再安装 Node.js。'],
    ['知识库绝对路径','确保所有 agent 访问的是你要使用的同一个库。'],
],[159,CW-159])
gap(8)
add('<b>能力边界：</b>如果该客户端不支持本地 stdio MCP，或 agent 没有本机文件/注册权限，它无法自行完成接入。应让它说明限制，并提供客户端界面的导入步骤。手动注册的条目需自行维护和移除。', 'small')

# Page 5
newpage();title(5,'第一次使用：写两篇关联笔记','用这个小例子确认 Markdown、反向链接、全文搜索和网络视图都能工作。')
step(1,'创建“项目规划”','点击右上角 <b>＋ 新建笔记</b>，标题填“项目规划”，分类填“工作”，标签填“项目”，写下正文并保存。分类保持一层即可，多个标签用逗号分开。')
step(2,'创建“会议记录”，写入链接','再建一篇标题为“会议记录”的笔记，将下面的内容写入正文后保存。示例使用唯一标题作链接；长期维护也可以使用文件 ID。')
code(['# 本周会议', '', '- 讨论登录失败时的提示。', '- 后续行动见 [[项目规划]]。'])
add('上面的中文正文可直接输入；链接写法是两个左方括号和两个右方括号。打开“项目规划”，应能在反向链接中看到“会议记录”。', 'small')
step(3,'搜索正文','在左侧搜索框输入“登录失败”。即使标题和标签中没有这几个字，也能通过正文命中并看到片段。输入多个空格分隔的词时，默认为全部命中；换词或缩短关键词可以扩大范围。')
h('打开“关联网络”后，可以这样操作')
table(['操作','效果'],[
    ['拖动空白处 / 方向键','移动视角。'],
    ['滚轮 / ＋、− 按钮','缩放视图。'],
    ['拖动节点','拖动时优先响应鼠标；松手后后台布局按斥力和关联分离。'],
    ['悬停 / 点击节点','查看标题 / 打开对应笔记。'],
    ['适应视野 / 暂停布局','重置观察范围 / 暂停与继续动态布局。'],
],[171,CW-171])
gap(7)
add('网络默认展示筛选结果的前 1,000 个节点。大库可先用正文搜索、分类或标签缩小范围。看板按照笔记状态分组；右上角色点可切换标志色，并在下次打开时恢复。', 'small')
note('<b>关闭与运行：</b>关闭窗口会退出 UI。若 agent 仍连接着 MCP，它管理的独立工具进程可继续工作；这与开机自启动或托盘驻留不同。')

# Page 6
newpage();title(6,'数据位置、升级与常见问题','数据集中保存在安装目录下的 data；右上角“数据目录”可直接打开。')
table(['内容','默认路径'],[
    ['Markdown 笔记',r'D:\Link Garden\data\vault'],
    ['配置备份与接入记录',r'D:\Link Garden\data\integrations'],
    ['缓存 / 日志',r'D:\Link Garden\data\profile / logs'],
],[141,CW-141])
add('无 D 盘时以上路径改为 C 盘；自选目录以界面为准。备份前退出 UI 并断开 MCP，再复制整个 data。Agent 全局配置、系统快捷方式仍在各自用户目录。', 'small')
h('常见问题速查')
table(['现象','处理方法'],[
    ['已安装，但 Agent 看不到工具','先完成 Agent 全局注册与信任核验，再重载 MCP。独立诊断不能代替客户端权限检查。'],
    ['客户端未检测到','先启动客户端一次，再重新检测；自定义路径或 Profile 使用 REGISTER-MCP.md。'],
    ['关联提示冲突或格式错误','不要覆盖整个配置。检查同名服务、配置格式或手改 skill；必要时让 agent 按指南局部修复。'],
    ['搜索不到想要的内容','改用原文可能出现的短词；标签筛选可先清空。关键词检索不保证同义词自动匹配。'],
    ['外部修改或导入文件没出现','点击“刷新”。当前只读库根目录 .md；文件 ID 用 1-80 位英文字母、数字、下划线或连字符，中文标题写在 frontmatter 中。'],
    ['移动程序后工具连接失败','重新安装并让 Agent 按新指南全局核验路径。不要只搬动单个 exe；客户端条目需同步更新。'],
],[141,CW-141])
h('升级和卸载')
add('升级沿用原目录，保留 data。首次运行会复制旧 AppData 笔记与设置，同名不同内容不覆盖；结果见 data/.layout.json。旧 C 盘原件保留，确认完整后可自行删除旧备份。')
add('从 Windows“设置 → 应用”中卸载 Link Garden。卸载只移除程序文件，<b>保留整个 data</b>。不要手动删除整个安装目录。由 Agent 注册的新条目和信任设置，需要在客户端自行移除。')
gap(4)
add('教程依据：Link Garden 0.5.0 安装器与实际界面。适配范围、按钮名称和默认路径以此版本为准。', 'small')

class NumberedCanvas(canvas.Canvas):
    def __init__(self,*args,**kwargs):
        canvas.Canvas.__init__(self,*args,**kwargs)
        self._pages=[]
    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        total=len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            self.setStrokeColor(LINE);self.setLineWidth(.5);self.line(44,43,WIDTH-44,43)
            self.setFont('YaHei',8);self.setFillColor(MUTED)
            self.drawString(44,29,'LINK GARDEN  /  安装与接入教程  /  0.5.0')
            self.drawRightString(WIDTH-44,29,f'{self._pageNumber} / {total}')
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

def header(c,doc):
    c.saveState()
    c.setFillColor(GREEN);c.rect(0,HEIGHT-7,WIDTH,7,stroke=0,fill=1)
    c.setFont('YaHei',8);c.setFillColor(MUTED)
    c.drawString(44,HEIGHT-29,'Link Garden')
    c.drawRightString(WIDTH-44,HEIGHT-29,'Windows 10 / 11 x64')
    c.restoreState()

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=49,bottomMargin=57,title='Link Garden 0.5.0 安装与接入教程',author='Link Garden',subject='Windows 安装、Agent MCP 关联、首次使用与故障排查')
doc.build(story,onFirstPage=header,onLaterPages=header,canvasmaker=NumberedCanvas)
print(OUT)
