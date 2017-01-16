;(function(global) {

    if(Object && Object.values) {
    } else {
        Object.values = function(myObj) {
            return $.map(myObj, function(val, key) { return val; });
        }
    }

    var remote_url = ("file:" != window.location.protocol)? window.location.href : "";

    var cache_data = {};

    var _init = function(dom) {
        return new C($(dom));
    };

    var C = function (div) {
        this.div = div;
        this._report_type = null;

        var id = div.attr("report-id");
        var c = this.getReportConfig(div.attr("report-config"));

        // 如果取不到id
        if(!id) {
            var d = JSON.parse(decodeURIComponent(div.attr("report-data") || '{}'));
            if(d) {
                var type = (c && c["type"])? c["type"] : d["type"];
                if("table" == type) {
                    this.showTable(0,d,c);
                } else {
                    this.showChart(0,d,c);
                }
            } else {
                this._show_msg("没有设置report-id或report-data");
            }
        } else {
            // 取数据
            var d = this.getReportData(div.attr("report-config"),div.attr("report-condition"));

            if(c && c["reload_interval"] && parseInt(c["reload_interval"]) >= 10) {
                var _this = this;
                setInterval(function() {
                    _this.getData(id,d,c);
                },parseInt(c["reload_interval"]) * 1000);
            }
            this.getData(id,d,c);
        }
    };

    C.prototype.getReportData = function(config,condition) {
        var result = {};

        if(condition) {
            var t = JSON.parse( '{' + $.trim(condition) + '}');
            if(t) result = t;
        }

        if(config) {
            var t = JSON.parse( '{' + $.trim(config) + '}');
            if(t && t["type"]) result["__type"] = t["type"];
            if(t && t["token"]) result["__token"] = t["token"];
            if(t && t["column"]) result["__column"] = t["column"];
        }
        return result;
    };

    C.prototype.getReportConfig = function(config) {
        var result = {};
        if(config) {
            var t = JSON.parse( '{' + $.trim(config) + '}');
            if(t) result = t;
            if(t && t["type"]) this._report_type = t["type"];
        }
        return result;
    };

    C.prototype.loading = function(show) {
        if(!jQuery.isFunction(jQuery.fn.showLoading)) return false;
        if(show) {
            this.div.showLoading();
        } else {
            this.div.hideLoading();
        }
    };

    C.prototype.getData = function (id,data,config) {
        var url = (global.EZ && global.EZ.report_remote_url)? EZ.report_remote_url : remote_url;
        var _this = this;

        // 如果有缓存就不再次请求了
        var cache_key = null;

        // 如果有设置定时更新就没必要缓存了
        if(!config["reload_interval"]) {
            var t = data["__type"];
            data["__type"] = null;
            cache_key = id + "-"+ JSON.stringify(data);
            if(cache_data[cache_key]) {
                this.show(id,cache_data[cache_key],config);
                return false;
            }
            data["__type"] = t;
        }

        this.loading(true);
        $.ajax({
            type: "get",
            async: false,
            url: url + id,
            dataType: (global.EZ && global.EZ.report_remote_type)? global.EZ.report_remote_type : "jsonp",
            data : data,
            success: function(data) {
                if(cache_key) cache_data[cache_key] = data;
                _this.loading(false);
                _this.show(id,data,config);
            },
            error: function() {
                _this.loading(false);
                _this._show_msg("获取配置信息失败: " + remote_url + id);
            }
        });
    };

    C.prototype.show = function (id,data,config) {
        if(0 == data["code"] && data["data"]) {
            if("table" == data["data"]["type"]) {
                this.showTable(id,data["data"],config);
            } else {
                this.showChart(id,data["data"],config);
            }
        } else {
           if(data["msg"]) this._show_msg(data["msg"]);
        }
    };

    C.prototype.showTable = function (id,data,config) {
        if(undefined == global.Gri || undefined == Gri.initDataTable) {
            this._show_msg("本报表需要载入table组件");
            return false;
        }
        var dom_id = "ez-report-" + id + " - " + Math.ceil(Math.random() * 1000);
        this.div.empty();
        this.div.append("<div id='" + dom_id + "'></div>");
        this.div.css("overflow","hidden");

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

    C.prototype._getNormalChartPlotOption = function (type,options) {
        switch(type) {
            case 'pie_3d':  case 'circular': case 'circular_3d':
                var t = type.split("_");
                var t0 = t[0];
                var t1 = (t[1] && undefined != $.inArray(t[1],['3d']))? t[1] : "";
                options.plotOptions = {
                    pie: {
                        innerSize: ("circular" == t0)? 100 : 0,
                        depth: 45
                    }
                };
                if("3d" == t1) {
                    options.chart.options3d = {
                        enabled: true,
                        alpha: 45
                    };
                }
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
            case "pyramid": 
                options.chart = {
                    type : type, 
                    marginRight: 100
                };
                options.plotOptions = {
                    series: {
                        dataLabels: {
                            enabled: true,
                            format: '<b>{point.name}</b> ({point.y})',
                            color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                        }
                    }
                };
                break;
            case 'funnel': 
                options.chart = {
                    type: 'funnel',
                    marginRight: 100
                };
                options.plotOptions = {
                    series: {
                        dataLabels: {
                            enabled: true,
                            format: '<b>{point.name}</b> ({point.y})',
                            color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black',
                            softConnector: true
                        },
                        neckWidth: '30%',
                        neckHeight: '25%'
                    }
                };
                break;
        }
        return options;
    };

    C.prototype._getTrendChartPlotOption = function (type,options,data) {
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
        options.tooltip = {shared: true, crosshairs: false, formatter: this.tipsFormatter};

        switch(type) {
            case 'area_pile': case 'area_percent':
                var t = type.split("_");
                var t1 = (t[1] && undefined != $.inArray(t[1],['pile',"percent"]))? t[1] : "";
                if("pile" == t1) t1 = "normal";

                options.chart = {
                    type: "area"
                };
                options.plotOptions = {
                    area: {
                        stacking: t1
                    }
                };
                break;
            case 'column_3d': case 'column_pile': case 'column_percent': case 'column_pile_3d': case 'column_percent_3d':
                var t = type.split("_");
                var t1 = (t[1] && ($.inArray(t[1],['3d','pile',"percent"]) >= 0))? t[1] : "";
                var t2 = (t[2] && ($.inArray(t[2],['3d']) >= 0))? t[2] : "";

                options.chart = { type: "column" };
                if("3d" == t1 || "3d" == t2 ) {
                    options.chart.options3d = {
                        enabled: true,
                        alpha: 15,
                        beta: 15,
                        depth: 50,
                        viewDistance: 25
                    };
                }
                if($.inArray(t1,['pile',"percent"]) >= 0) {
                    if("pile" == t1) t1 = "normal";
                    options.plotOptions = {
                        column: {
                            stacking: t1
                        }
                    };
                }
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
            case 'heatmap':
                options.chart = {type: "heatmap"};
                options.colorAxis = {
                    min: 0,
                    minColor: '#FFFFFF',
                    maxColor: Highcharts.getOptions().colors[0]
                };
                options.yAxis = {
                    categories: data.ycategories,
                    title : ""
                };
                options.legend = {
                    align: 'right',
                    layout: 'vertical',
                    margin: 0,
                    verticalAlign: 'top',
                    y: 25
                    //symbolHeight: 280
                };
                options.tooltip = {
                    formatter: function () {
                        return '<b>' + this.series.xAxis.categories[this.point.x] + '</b><br/><b>' + 
                            this.series.yAxis.categories[this.point.y] + '</b><br>'+
                            this.point.value + '</b>';
                    }
                };
                break;
            case 'spiderweb' : case 'spiderweb_line': case 'spiderweb_area': case 'spiderweb_column':
            case 'polar': case 'polar_line': case 'polar_area': case 'polar_column':
            case 'polar_column_pile': case 'spiderweb_column_pile': case 'polar_area_pile': case 'spiderweb_area_pile':
            case 'polar_column_percent': case 'spiderweb_column_percent': case 'polar_area_percent': case 'spiderweb_area_percent':
                var t = type.split("_");
                var t0 = (t[0] == "spiderweb")? t[0] : "polar";
                var t1 = (t[1] && undefined != $.inArray(t[1],['line','area','column']))? t[1] : "line";
                var t2 = (t[2] && undefined != $.inArray(t[2],['pile',"percent"]))? t[2] : "";
                if("pile" == t2) t2 = "normal";

                options.chart = {
                    polar: true,
                    type: t1
                };
                options.xAxis = {
                    categories: data.categories,
                    tickmarkPlacement: 'on',
                    lineWidth: 0
                };
                if("spiderweb" == t0) {
                    options.yAxis = {
                        gridLineInterpolation: 'polygon',
                        lineWidth: 0,
                        min: 0
                    };
                }
                options.tooltip = {
                    shared: true,
                    pointFormat: '<span style="color:{series.color}">{series.name}: <b>{point.y}</b><br/>'
                };
                if("" != t2) {
                    options.plotOptions = {
                        series: {
                            stacking: t2,
                            shadow: false,
                            groupPadding: 0,
                            pointPlacement: 'on'
                        }
                    }; 
                }
                break;
        }
        return options;
    };

    C.prototype.tipsFormatter = function () {
        var tips = '<b>' + this.x + '</b><br/>';
        for (var i = 0; i < this.points.length; ++i) {
            var name = this.points[i].series.name;
            var val = Highcharts.numberFormat(this.points[i].y, -1, '.', ',');

            // if(this.points[i].series.suffix) {
            //     var val = val + this.points[i].series.suffix;
            // }
            // if(this.points[i].series.suffix.prefix) {
            //     var val = this.points[i].series.prefix + val;
            // }
            tips += '<span style="color:' + this.points[i].series.color + '">\u25CF</span>' + 
                    name + ': <b style="color:' + this.points[i].series.color + '">' + val + '</b><br/>';
        }
        return tips;
    };

    C.prototype.getChartOptions = function (type,data,config,src_data) {    
        var options = {};

        var title = (config["title"])? config["title"] : 
                                ((src_data["config"] && src_data["config"]["title"])? src_data["config"]["title"] : "");
        var subtitle = (config["subtitle"])? config["subtitle"] : 
                            ((src_data["config"] &&  src_data["config"]["subtitle"])? src_data["config"]["subtitle"] : ""); 

        options.title = {text: title};
        options.subtitle = {text: subtitle};
        options.credits = {enabled: false};

        switch(type) {
            case "spline": case "column": case "area": case "bar": case "area_pile": case "area_percent":
            case "column_3d": case "column_pile": case "column_pile_3d": case "column_percent": case 'column_percent_3d':
            case "heatmap": 
            case 'spiderweb' : case 'spiderweb_line': case 'spiderweb_area': case 'spiderweb_column':
            case 'polar': case 'polar_line': case 'polar_area': case 'polar_column':
            case 'polar_column_pile': case 'spiderweb_column_pile': case 'polar_area_pile': case 'spiderweb_area_pile':
                        case 'polar_column_percent': case 'spiderweb_column_percent': case 'polar_area_percent': case 'spiderweb_area_percent':
                options = this._getTrendChartPlotOption(type,options,data);
                break;
            case 'pie': case 'pie_3d': case 'circular': case 'circular_3d': case 'sector': case 'circular_sector':
            case 'pyramid': case 'funnel': 
                options.chart = {type: "pie"};
                options = this._getNormalChartPlotOption(type,options);
                break;
            default: 
                break;
        }
        options.series = data.series;
        return options;
    };

    C.prototype.getChartData = function (data,config) {
        var type = (this._report_type)? this._report_type : data["type"]; // 使用本地设定的图型
        //var type = data["type"];
        switch(type) {
            case "spline": case "column": case "area": case "bar": case "area_pile": case "area_percent":
            case "column_3d": case "column_pile": case "column_pile_3d": case "column_percent": case 'column_percent_3d':
            case 'spiderweb' : case 'spiderweb_line': case 'spiderweb_area': case 'spiderweb_column':
            case 'polar': case 'polar_line': case 'polar_area': case 'polar_column':
            case 'polar_column_pile': case 'spiderweb_column_pile': case 'polar_area_pile': case 'spiderweb_area_pile':
            case 'polar_column_percent': case 'spiderweb_column_percent': case 'polar_area_percent': case 'spiderweb_area_percent':
                var categories = [];
                var series = {};

                var config_list = data["config"];
                for(field in config_list["field_list"]) {
                    series[field] = {name: config_list["field_list"][field], data: []};

                    if(config_list["color_list"] && config_list["color_list"][field]) {
                        series[field].color = config_list["color_list"][field];
                    }
                    if(config_list["line_list"] && config_list["line_list"][field]) {
                        series[field].dashStyle = config_list["line_list"][field];
                    }
                    // if(config_list["prefix_list"] && config_list["prefix_list"][field]) {
                    //     series[field].prefix = config_list["prefix_list"][field];
                    // }
                    // if(config_list["suffix_list"] && config_list["suffix_list"][field]) {
                    //     series[field].suffix = config_list["suffix_list"][field];
                    // }
                }
                for (key in data["data"]) {
                    categories.push(key);
                    for (field in config_list["field_list"]) {
                        series[field].data.push(parseFloat(data["data"][key][field] || null));
                    }
                }
                return {
                    categories: categories,
                    series: Object.values(series)
                };
            case 'pie': case 'pie_3d': case 'circular': case 'circular_3d': case 'sector':  case 'circular_sector':
            case 'pyramid': case 'funnel': 
                var series = [{name: '', data: []}];
                var color_list = {};
                if (data["config"]["color_list"]) color_list = data["config"]["color_list"];
                
                var d = (Object.values(data["data"])).pop(); // data["data"][0];
                for (field in data["config"]["field_list"]) {
                    var _data = {name: data["config"]["field_list"][field], y: parseFloat(d[field] || 0)};
                    if (color_list[field]) _data.color = color_list[field];
                    series[0].data.push(_data);
                }
                return {
                    series: series
                };
            case 'heatmap': 
                var categories = [];
                var ycategories = [];
                var series = [
                    {
                        "name" : "",
                        "data" : [],
                        dataLabels: {
                            enabled: true
                        }
                    }
                ];
                var config_list = data["config"];

                var f_list = {};
                var index = 0;
                for(field in config_list["field_list"]) {
                    f_list[field] = index;
                    ycategories.push(config_list["field_list"][field]);
                    index++;
                }
                var d_index = 0;
                for (key in data["data"]) {
                    categories.push(key);
                    for(f in f_list) {
                        series[0].data.push([d_index,f_list[f],parseFloat(data["data"][key][f] || null)]);
                    }
                    d_index++;
                }
                return {
                    ycategories : ycategories,
                    categories: categories,
                    series: series
                };
                break;
        }
    };

    C.prototype.showChart = function (id,data,config) {
        if(undefined == global.Highcharts) {
            this._show_msg("本报表需要载入Highcharts组件");
            return false;
        }

        var d = this.getChartData(data,config);
        var type = (this._report_type)? this._report_type : data["type"]; // 使用本地设定的图型
        // var type = data["type"];
        options = this.getChartOptions(type,d,config,data);
        // options = $.extend(true, options, {});

        // console.log(JSON.stringify(options));
        this.div.highcharts(options, function (chart) {
            //$(".highcharts-tooltip").hide();
            $("text").each(function() {
                if("Highcharts.com" == $(this).html()) $(this).hide();
            });
        });
    };

    C.prototype._show_msg = function(msg) {
        this.div.html("<span style='padding: 5px;color:red;display:inline-block;'>" + msg + "</span>");
    };

    global.EZ = global.EZ || {};
    EZ.reportDisplay = _init;

})(this);