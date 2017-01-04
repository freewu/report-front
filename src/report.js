(function(global) {

    var remote_url = ("file:" != window.location.protocol)? window.location.href : "";

    var div;
    var config = {};
    var _report_type = null;
    var _init = function(dom) {
        div = $(dom);

        var id = div.attr("report-id");
        var config = div.attr("report-config");
        var condition = div.attr("report-condition");
        var data =  getReportData(config,condition);

        // 如果取不到id
        if(!id) {
            var d = JSON.parse(decodeURIComponent(div.attr("report-data") || '{}'));
            if(d) {
                var c = getReportConfig(config);
                var type = (c && c["type"])? c["type"] : d["type"];

                if("table" == type) {
                    showTable(0,d,c);
                } else {
                    showChart(0,d,c);
                }
            } else {
                _show_msg("没有设置report-id或report-data");
            }
        } else {
            // 取数据
            getData(id,getReportData(config,condition),getReportConfig(config));
        }
    };

    var getReportData = function(config,condition) {
        var result = {};

        if(condition) {
            var t = JSON.parse( '{' + $.trim(condition) + '}');
            if(t) result = t;
        }
        if(config) {
            var t = JSON.parse( '{' + $.trim(config) + '}');
            if(t && t["type"]) {
                result["__type"] = t["type"];
                _report_type = t["type"]; // 报表类型
            };
            if(t && t["token"]) result["__token"] = t["token"];
            if(t && t["column"]) result["__column"] = t["column"];
        }
        return result;
    };

    var getReportConfig = function(config) {
        var result = {};
        if(config) {
            var t = JSON.parse( '{' + $.trim(config) + '}');
            if(t) result = t;
        }
        return result;
    };

    var loading = function(show) {
        if(!jQuery.isFunction(jQuery.fn.showLoading)) return false;
        if(show) {
            div.showLoading();
        } else {
            div.hideLoading();
        }
    };

    var getData = function (id,data,config) {
        var url = (global.EZ && global.EZ.report_remote_url)? EZ.report_remote_url : remote_url;

        loading(true);
        $.ajax({
            type: "get",
            async: false,
            url: url + id,
            dataType: (global.EZ && global.EZ.report_remote_type)? global.EZ.report_remote_type : "jsonp",
            data : data,
            success: function(data) {
                loading(false);
                if(0 == data["code"] && data["data"]) {
                    if("table" == data["data"]["type"]) {
                        showTable(id,data["data"],config);
                    } else {
                        showChart(id,data["data"],config);
                    }
                } else {
                   if(data["msg"]) _show_msg(data["msg"]);
                }
            },
            error: function() {
                loading(false);
                _show_msg("获取配置信息失败: " + remote_url + id);
            }
        });
    };

    var showTable = function (id,data,config) {
        if(undefined == global.Gri || undefined == Gri.initDataTable) {
             _show_msg("本报表需要载入table组件");
            return false;
        }
        var dom_id = "ez-report-" + id + " - " + Math.ceil(Math.random() * 1000);
        div.append("<div id='" + dom_id + "'></div>");
        div.css("overflow","hidden");

        var c = {
            tableId: dom_id,
            data: data["data"],
            allFields: data["config"],
            enableThClick:false //是否开启排序功能
            //noPage : true
            //page: {}
        };
        var pagesize = (config && config["pagesize"] && parseInt(config["pagesize"]))? config["pagesize"] : 5;
        if(data["data"] && data["data"].length > pagesize) {
            c["page"] = { size : pagesize };
        } else {
            c["noPage"] = true;
        }
        Gri.initDataTable(c);
    };

    var _getNormalChartPlotOption = function (type,options) {
        switch(type) {
            case 'pie_3d': 
                options.chart.options3d = {
                    enabled: true,
                    alpha: 45
                };
                options.plotOptions = {
                    pie: {
                        depth: 45
                    }
                };
                break;
            case 'circular': 
                options.plotOptions = {
                    pie: {
                        innerSize: 100,
                        depth: 45
                    }
                };
                break;
            case 'circular_3d':
                options.chart.options3d = {
                    enabled: true,
                    alpha: 45
                };
                options.plotOptions = {
                    pie: {
                        innerSize: 100,
                        depth: 45
                    }
                };
                break;
            case 'sector': 
                options.plotOptions = {
                    pie: {
                        startAngle: -90,
                        endAngle: 90,
                        center: ['50%', '75%']
                    }
                };
                break;
            case 'circular_sector':
                options.plotOptions = {
                    pie: {
                        innerSize: 100,
                        startAngle: -90,
                        endAngle: 90,
                        center: ['50%', '75%']
                    }
                };
                break;
        }
        return options;
    };

    var _getTrendChartPlotOption = function (type,options,data) {
        options.chart = {type: type};
        options.xAxis = {
            categories: data.categories
        };
        options.yAxis = {
            title: {
                text: ''
            }, 
            labels: {
                formatter: function() {
                    return this.value;
                }
            }
        };
        options.tooltip = {shared: true, crosshairs: false, formatter: tipsFormatter};

        switch(type) {
            case 'column_3d': 
                options.chart = {type: "column"};
                options.chart.options3d = {
                    enabled: true,
                    alpha: 15,
                    beta: 15,
                    depth: 50,
                    viewDistance: 25
                };
                break;
            case 'bar':
                options.plotOptions = {
                    bar: {
                        dataLabels: {
                            enabled: true
                        }
                    }
                };
                break;
            case 'column_pile':
                options.chart = {type: "column"};
                options.plotOptions = {
                    column: {
                        stacking: 'percent'
                    }
                };
                break;
            case 'column_pile_3d':
                options.chart = {type: "column"};
                options.chart.options3d = {
                    enabled: true,
                    alpha: 15,
                    beta: 15,
                    depth: 50,
                    viewDistance: 25
                };
                options.plotOptions = {
                    column: {
                        stacking: 'normal',
                        depth: 40
                    }
                };
                break;
            case 'area_pile':
                options.chart = {type: "area"};
                options.plotOptions = {
                    area: {
                        stacking: 'normal'
                    }
                };
                break;
        }
        return options;
    };

    var tipsFormatter = function () {
        var tips = '<b>' + this.x + '</b><br/>';
        for (var i = 0; i < this.points.length; ++i) {
            var name = this.points[i].series.name;
            var val = Highcharts.numberFormat(this.points[i].y, -1, '.', ',');

            if(config.suffix && config.suffix[name]) {
                var val = val + config.suffix[name];
            }
            if(config.prefix && config.prefix[name]) {
                var val = config.prefix[name] + val;
            }
            tips += '<span style="color:' + this.points[i].series.color + '">\u25CF</span>' + 
                    name + ': <b style="color:' + this.points[i].series.color + '">' + val + '</b><br/>';
        }
        return tips;
    };

    var getChartOptions = function (type,data,config) {    
        var options = {};
        options.title = {text: ''};
        options.subtitle = {text: ''};
        options.credits = {enabled: false};

        switch(type) {
            case "spline": case "column": case "area": case "bar": case "area_pile":
            case "column_3d": case "column_pile": case "column_pile_3d":
                options = _getTrendChartPlotOption(type,options,data);
                break;
            case 'pie': case 'pie_3d': case 'circular': case 'circular_3d': case 'sector': case 'circular_sector':
                options.chart = {type: "pie"};
                options = _getNormalChartPlotOption(type,options);
                break;
            default: 
                break;
        }
        options.series = data.series;
        return options;
    };

    var getChartData = function (data,config) {
        var type = (_report_type)? _report_type : data["type"]; // 使用本地设定的图型
        switch(type) {
            case "spline": case "column": case "area": case "bar": case "area_pile":
            case "column_3d": case "column_pile": case "column_pile_3d":
                var categories = [];
                var series = {};

                var config_list = data["config"];
                config = data["config"]; // 引入互全局里去 tipsFormatter需要用到
                for(field in config_list["field_list"]) {
                    series[field] = {name: config_list["field_list"][field], data: []};

                    if(config_list["color_list"] && config_list["color_list"][field]) {
                        series[field].color = config_list["color_list"][field];
                    }
                }
                for (key in data["data"]) {
                    categories.push(key);
                    for (field in config_list["field_list"]) {
                        series[field].data.push(parseFloat(data["data"][key][field] || 0));
                    }
                }
                return {
                    categories: categories,
                    series: Object.values(series)
                };
            case 'pie': case 'pie_3d': case 'circular': case 'circular_3d': case 'sector':  case 'circular_sector':
                var series = [{name: '', data: []}];
                var color_list = {};
                if (data["config"]["color_list"]) color_list = data["config"]["color_list"];
                
                for (field in data["config"]["field_list"]) {
                    var _data = {name: data["config"]["field_list"][field], y: parseFloat(data["data"][0][field] || 0)};
                    if (color_list[field]) _data.color = color_list[field];
                    series[0].data.push(_data);
                }
                return {
                    series: series
                };
        }
    };

    var showChart = function (id,data,config) {
        if(undefined == global.Highcharts) {
             _show_msg("本报表需要载入Highcharts组件");
            return false;
        }

        var d = getChartData(data,config);
        var type = (_report_type)? _report_type : data["type"]; // 使用本地设定的图型
        options = getChartOptions(type,d,config);
        // options = $.extend(true, options, {});

        div.highcharts(options, function (chart) {
            // console.log(chart);
        });
    };

    var _show_msg = function(msg) {
        div.html("<span style='padding: 5px;color:red;display:inline-block;'>" + msg + "</span>");
    };

    global.EZ = global.EZ || {};
    EZ.reportDisplay = _init;

})(this);