<?php
$file = isset($argv[1])? $argv[1] : "normal_chart";
$file = "demo/".$file.".json";
if(!file_exists($file)) die($file." 文件不存在");

$c = file_get_contents($file);
$j = json_decode($c,true);
if(!$j) die("解析json失败!");

echo urlencode(json_encode($j["data"]));