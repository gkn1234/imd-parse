```
# 安装依赖
npm install

# 执行 json 转 imd
node jsonToImdScript.mjs nbblast_4k_hd.json

# 执行 imd 转 json，第二个参数是 key 数
node imdToJsonScript.mjs nbblast_4k_hd.imd 4

# 拉去所有官谱数据，并进行谱面转换，第一个参数若为 true 会强制重新下载数据
node downloadImds.mjs true
```