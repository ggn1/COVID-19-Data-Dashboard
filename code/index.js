// UTILITY FUNCTIONS/VARIABLES
/* Utility functions/variables are ones which provide
   general services/values for other functions to use. */

// define color scheme colors
var color_dark = "#1e1e30";
var color_medium = "#9b9bc4";
var color_light = "#ffffff";
var color_accent = "#f5f553";

// define variables that are to store data

// store raw covid dataset
var data_covid = null;

// store raw geojson data
var data_geojson = null;

// store data from selected time period
var data_cur_time = null;

// store variables to be displayed
// which were extracted from the raw dataset
var useful_data = null;

// ranges/extents of every useful variable
var extents = {};

// currently selected country if any
var selected_country = {path:null, code:null};

// map of country codes to countries
var locations_map = new Map();

// map of all continents in
// the dataset to the 
// countries within them
var continents_map = new Map();

// list of years that 
// the data spans
var years = [];

// list of months in a year
const month_names = [
    "Jan", "Feb", "Mar", "Apr",
    "May", "Jun", "Jul", "Aug",
    "Sep", "Oct", "Nov", "Dec"
];

const fill_series = ({start,end,jump }) => {
    /** Returns an array of numbers from "start" to "end" 
     *  with jump as skip interval between two numbers. 
     *  For example, fill_series({start: 0,end: 10,jump: 2}) 
     *  would return [0, 2, 4, 6, 8] */
    range = [];
    for (let i=start; i<end; i+=jump)
        range.push(i);
    return range;
}

const split_range = (start, end, parts) => {
    /** Splits given range of numbers (given the start 
     *  and end of the range) into given no. of equal parts. */
    let result = [],
    delta = (end - start) / (parts - 1);
    while (start < end) {
        result.push(start);
        start += delta;
    }
    result.push(end);
    return result;
}

// TIMELINE
const make_timeline = () => {
    /** Function that adds a timeline. */

    // the timeline can have
    // 3 timescales: 
    //   0 => years (default)
    //   1 => months
    //   2 => days
    let timescale = 0;

    // add timeline svg
    let svg = d3.select("#timeline").append("svg");

    // get width and height of added svg in pixels
    let width_px = svg.style("width").replace("px", "");
    let height_px = svg.style("height").replace("px", "");

    // define axis group and scale
    let axis = svg.append("g")
                  .attr("transform",`translate(${0},${40})`);
    let scale = d3.scaleBand().range([50, width_px-50]);

    let filter_time = ({day, month, year}) => {
        /** Function that updates data_cur_time 
         *  with data filtered as per given time. */
        let filtered_data = [...data_covid];
        let display_text = "" // time label to display on screen
    
        // filter by year if given
        if (year != null) {
            filtered_data = filtered_data.filter(
                row => row.date.getFullYear() == year
            );
            display_text = String(year) + display_text;
        }
    
        // filter by month if given
        if (month != null){
            filtered_data = filtered_data.filter(
                row => row.date.getMonth() == month
            );
            display_text = month_names[month] + " " + display_text;
        }
    
        // filter by day if given
        if(day != null){
            filtered_data = filtered_data.filter(
                    row => row.date.getDate() == day
            );
            display_text = String(day) + " " + display_text;
        }
        
        // sort filtered data by date
        filtered_data.sort((a, b) => {
            return d3.ascending(a.date, b.date);
        });
    
        // update data to be displayed 
        // to be equal to filtered data
        data_cur_time = filtered_data;
    
        // update time display
        d3.select("#time_display").text(display_text);
    }


    let select_tick = (tick_text) => {
        /** Function that prompts update of 
         *  data based on given text selection. */

        // get words in given text associated 
        // with currently selected tick
        tick_text = tick_text.split(" ");

        // create a time filter object
        // whose values shall be set later
        time_filter = {year:null, month:null, day:null};

        // if the no. of words in given 
        // tick text is 1, then the timeline 
        // is in year scale 
        if (tick_text.length == 1) {
            time_filter.year = parseInt(tick_text[0]);
        }

        // if the no. of words in given 
        // tick text is 2, then the timeline 
        // is in year scale 
        else if (tick_text.length == 2) {
            time_filter.month = month_names.indexOf(tick_text[0]);
            time_filter.year = parseInt(tick_text[1]);
        }

        // if the no. of words in given 
        // tick text is 3, then the timeline 
        // is in year scale 
        else if (tick_text.length == 3) {
            time_filter.day = parseInt(tick_text[0]);
            time_filter.month = month_names.indexOf(tick_text[1]);
            time_filter.year = parseInt(tick_text[2]);
        }

        // filter time as per time period values
        // derived from currently selected tick text
        filter_time(time_filter);
    }

    let shift_scale = (tick_text) => {
        /** Function that alters timescale and
         *  updates data_cur_time according 
         *  to new scale data. */

        // get oldest and newest  
        // date from current data
        let oldest_date = data_cur_time[0].date;
        let latest_date = data_cur_time.slice(-1)[0].date;

        // if timescale is in years, shift to months
        if (timescale == 0) {
            timescale = 1; 

            // update ticks
            update_ticks(month_names.slice(
                oldest_date.getMonth(),
                latest_date.getMonth()+1
            ).map(month_name => {
                return month_name + " " + tick_text;
            }));

            // select new tick
            tick_text = month_names[
                latest_date.getMonth()
            ] + " " + tick_text;
            select_tick(tick_text);
        }

        // if timescale is in months, shift to days
        else if (timescale == 1){
            timescale = 2;

            // update ticks
            update_ticks(fill_series({
                start: oldest_date.getDate(),
                end: latest_date.getDate()+1,
                jump: 1
            }).map(num => {
                return String(num) + " " + tick_text;
            }));

            // select new tick
            tick_text = String(
                latest_date.getDate()
            ) + " " + tick_text;
            select_tick(tick_text);
        }

        // if timescale is in days, shift to years
        else if (timescale == 2){
            timescale = 0;

            // update ticks
            update_ticks(years);

            // select new tick
            tick_text = String(latest_date.getFullYear())
            select_tick(tick_text);
        }
    }

    let update_ticks = (domain) => {
        /** Update scale of axis with given domain and
         *  updates ticks to have desired design and interaction. */

        // update scale domain
        scale.domain(domain);
        axis.transition().duration(1000).call(d3.axisBottom(scale));
        
        // get ticks
        let ticks = svg.selectAll(".tick");
        
        // add tick text transform
        ticks.selectAll("text")
             .attr("opacity", 0)
             .attr("font-size", "1.5em")
             .attr("transform",`translate(${0},${-40})`);

        // replace tick lines with circles to 
        // which event listeners are attached
        ticks.select("line").remove();
        ticks.append("circle")
             .on("click", (e, d) => {
                 let tick = d3.select(e.path[1]);
                select_tick(tick.text());
                if (e.shiftKey == true) {
                   shift_scale(tick.text()); 
                }
            })
            // show tick text on mouseover
            .on("mouseover", (e, d) => {
                let tick = d3.select(e.path[1]);
                tick.select("text")
                    .transition().duration(300)
                    .attr("opacity", 1);
            })
            // hide tick text on mouseout
            .on("mouseout", (e, d) => {
                let tick = d3.select(e.path[1]);
                tick.select("text")
                    .transition().duration(300)
                    .attr("opacity", 0);
            });
    }
    
    // initialize timeline scale to be in years
    update_ticks(years);

    // select tick corresponding to the latest
    // year to initialize dashboard to display
    // data from the latest year
    select_tick(String(years.slice(-1)[0]));
}

// MAP LAYOUT
var map_layout = null;
const make_map_layout = () => {
    /** Makes and adds map layout. */
    let obj = {};

    // currently selected country if any
    let cur_selection = {path:null, code:null}
    
    let svg = d3.select("#map_layout")
                .attr("background-color", "#8b87d5")
                .append("svg");
    let width_px = svg.style("width").replace("px", "");
    let height_px = svg.style("height").replace("px", "");

    // color scale
    let color_scale = d3.scaleLinear()
                        .domain(extents.new_case_rate)
                        .range([color_medium, "red"])
                        .interpolate(d3.interpolateRgb);

    // path generator and projection
    let yaw = 0;
    let pitch = 0;
    let projection = d3.geoOrthographic()
                       .scale((width_px/Math.PI)*1.4)
                       .center([0, 0])
                       .translate([width_px/2,height_px/2])
                       .rotate([yaw, pitch, 0]);
    let geo_generator = d3.geoPath().projection(projection);
    
    // tooltip
    let tooltip = svg.append("g")
                     .attr("class", "tooltip")
                     .attr("opacity", 0);
    tooltip.append("rect");
    let tooltip_data_label = tooltip.append("text")
                                    .text("cr")
                                    .attr("x", 0)
                                    .attr("y", 40);
    let tooltip_country_label = tooltip.append("text")
                                       .attr("x", 0)
                                       .attr("y", 12)
                                       .attr("fill", color_light)
                                       .text("country");

    // add paths to be drawn
    let paths = svg.append("g")
                   .selectAll("path")
                   .data(data_geojson.features)
                   .join("path")
                   .attr("id",d=>`path_${d.id}`)
                   .attr("fill", color_light)
                   .attr("stroke", color_dark);
     
    // append event listeners to paths
    paths.on("mouseover", (e, d) => {
            // highlight country and show tooltip
            let iso_code = d.id;
            let country_data = useful_data.get(iso_code);
            let ncr = 0;
            if (country_data) {ncr = Math.round(
                country_data.new_case_rate*100
            )/100}
            tooltip.select("rect")
                   .attr("x", e.x-5)
                   .attr("y", e.y-25);
            tooltip_data_label.attr("x", e.x)
                              .attr("y", e.y)
                              .text(`ncr: ${ncr}`);
            tooltip_country_label.text(d.properties.name);
            tooltip.transition().duration(500)
                   .attr("opacity", 1);
        })
        .on("mouseout", (e, d) => {
            // hide tooltip 
            tooltip.transition()
            .duration(100)
            .attr("opacity", 0);
        })
        .on("click", (e, d) => {
            let path = d3.select(e.srcElement);
            let iso_code = d.id;
            let name = d.properties.name;
            let country_data = null;
            let prev_selection = {};
            Object.assign(prev_selection, selected_country);
            cur_selection = {path: path, code: iso_code}
                
            // unselect previously selected country id any
            selected_country.path = null;
            selected_country.code = null;
            country_data = useful_data.get(prev_selection.code);
            country_data && prev_selection.path.attr(
                "fill", color_scale(country_data.new_case_rate)
            );
            d3.select("#header").text("COVID19 World Data")

            // if this country is not the same as the previously
            // selected country, select it
            if (cur_selection.code != prev_selection.code
                && useful_data.get(cur_selection.code)
            ){
                selected_country.path = cur_selection.path;
                selected_country.code = cur_selection.code;
                path.attr("fill", color_accent);
                d3.select("#header").text(`COVID19 ${name} Data`);
            } else {cur_selection = {path: null, code: null}}
            
            // update bar layout data and cluster layout data
            bar_layout.update();
            cluster_layout.focus_country();
        });

    // bring tooltip to front
    tooltip.raise();

    let draw_paths = () => {
        /** Draws each country. */
        paths.attr("d", geo_generator);
    }

    draw_paths();

    // globe rotation
    // here window.requestAnimationFrame() is used so that the 
    // window refreshes after each frame movement is complete to
    // avoid the movement looking glitchy
    d3.select("body").on("keydown", (e, d) => {
        // right arrow pressed then rotate to right
        if(e.keyCode == 39){
            yaw -= 10;
            projection.rotate([yaw,pitch,0])
            window.requestAnimationFrame(draw_paths);
        }
        // left arrow pressed then rotate to left
        else if(e.keyCode == 37){
            yaw += 10;
            projection.rotate([yaw,pitch,0])
            window.requestAnimationFrame(draw_paths);
        }
        // up arrow pressed then rotate up
        else if(e.keyCode == 38){
            pitch += 10;
            projection.rotate([yaw,pitch,0])
            window.requestAnimationFrame(draw_paths);
        }
        // down arrow pressed then rotate down
        else if(e.keyCode == 40){
            pitch -= 10;
            projection.rotate([yaw,pitch,0])
            window.requestAnimationFrame(draw_paths);
        }
    });

    obj.update = () => {
        /** Updates Map */

        // change fill color of paths based on
        // latest NCR value of each country
        paths.transition().duration(1000)
             .attr("fill", d => {
                let country_data = useful_data.get(d.id);
                if (country_data) { 
                    return color_scale(
                        country_data.new_case_rate
                    );
                } else return color_medium;
             });
        
        // if a current selection exists, then dont't
        // change its color, leave it highlighted in
        // yellow until it is clicked again which selects it
        if (cur_selection.code != null){
            let sel_path = d3.select(`#path_${cur_selection.code}`);
            if (sel_path) { 
                sel_path.transition().duration(1000)
                        .attr("fill",color_accent);
            }
        }
    }

    return obj;
}

// BAR LAYOUT
var bar_layout = null;
const make_bar_layout = () => {
    /** Adds bar chart. */
    let obj = {}; 

    // add dropdown list
    let dropdown = d3.select("#bar_layout")
                     .append("g")
                     .attr("id", "blg1")
                     .append("select")
                     .attr("name", "features");

    // store features that are to be options in the 
    // dropdown list as a map. Each option has form 
    // [variable_name, Display Name]
    let options = [
        ["new_case_rate", "New Case Rate"],
        ["gdp_per_capita", "GDP Per Capita"],
        ["vaccination_rate", "Vaccination Rate"],
        ["booster_rate", "Booster Rate"],
        ["handwashing_facilities", "Handwashing Facilities"],
        ["stringency_index", "Stringency Index"],
        ["population", "Population"]
    ]
    
    let cur_option = ["new_case_rate", "New Case Rate"];

    dropdown.selectAll("option")
            .data(options)
            .join("option")
            .attr("name", d=>d[1])
            .attr("value", d=>d[0])
            .text(d=>d[1]);

    // add svg
    let svg = d3.select("#bar_layout").append("svg");

    // get dimensions of svg in pixels
    let width_px = Number(svg.style("width").replace("px",""));
    let height_px = Number(svg.style("height").replace("px",""));
    
    let margin = {
        left: 80, right: 40,
        top: 20, bottom: 40 
    };

    // add hover interaction of svg
    let hover_countries = [];
    d3.select("#bar_layout")
    // on mouse over highlight the continent
    // of selected country/ the hle globe 
    // in the map layout
    .on("mouseover", (e,d) => {
        // assume world to be highlighted by default
        // which would be the case if 
        // selected_country == null
        let region = "world"; 
        if (selected_country.path != null) {
            region = locations_map.get(
                selected_country.code
            ).continent;
        }
        if (region == "world") {
            Array.from(
                continents_map.values()
            ).map(arr => hover_countries.push(...arr));
        } else {
            // if a selected country exists,
            // then highlight only countries
            // that fall within the same continent as it
            hover_countries = continents_map.get(region);
        }
        hover_countries.forEach(code => {
            let path = d3.select(`#path_${code}`);
            path && path.attr("stroke", color_accent);
        })
    }).on("mouseout", (e,d) => {
        // set stroke color of all highlighted
        // parts of the map layout back to 
        // default color
        if (hover_countries) {
            hover_countries.forEach(code => {
                let path = d3.select(`#path_${code}`);
                path && path.attr("stroke",color_dark);
            })
            hover_countries = [];
        }
    });

    // add axes, define their scales
    let x_scale = d3.scaleBand()
        .range([margin.left, width_px-margin.right])
        .padding(0.2);
    let x_axis = svg.append("g")
        .attr("color", color_dark)
        .attr("transform",`translate(${0},${height_px-margin.bottom})`);
    let y_scale = d3
        .scaleLinear()
        .range([height_px-margin.bottom, margin.top]);
    let y_axis = svg.append("g")
        .attr("color", color_dark)
        .attr("transform",`translate(${margin.left}, ${0})`)
        .call(d3.axisLeft(y_scale));

    // tooltip (display) for cluster layout to use
    let ttg = svg.append("g")
                 .attr("class", "tooltip");
    ttg.append("rect")
       .attr("fill", color_dark)
       .attr("width", width_px)
       .attr("height", height_px)
       .attr("rx", 15)
       .attr("opacity", 0);
    // take this display back so that its
    // not visible until cluster layout needs it
    ttg.lower();

    let filter_region = () => {
        /** Filters out data by region. */

        // if no country is selected
        // then display data per continent
        if (selected_country.path == null) {
            data = Array.from(d3.rollup(
                [...useful_data.values()],
                row => ({
                    vaccination_rate: 
                        d3.mean(row, d=>d.vaccination_rate),
                    booster_rate: 
                        d3.mean(row, d=>d.booster_rate),
                    handwashing_facilities: 
                        d3.mean(row, d=>d.handwashing_facilities),
                    stringency_index: 
                        d3.mean(row, d=>d.stringency_index),
                    new_case_rate: 
                        d3.mean(row, d=>d.new_case_rate),
                    gdp_per_capita: 
                        d3.mean(row, d=>d.gdp_per_capita),
                    population: 
                        d3.mean(row, d=>d.population),
                    group: 
                        d3.max(row, d=>d.continent)
                }),
                row => row.continent
            ).values());
        } 

        // if a country is selected then display 
        // data of countries in the same continent
        // as the selected country
        else { 
            let continent = locations_map.get(
                selected_country.code
            ).continent;
            data = [];
            for (const obj of Array.from(
                useful_data.values()
            )) {
                if (obj.continent == continent) {
                    data.push({
                        vaccination_rate: 
                            obj.vaccination_rate,
                        booster_rate: 
                            obj.booster_rate,
                        handwashing_facilities: 
                            obj.handwashing_facilities,
                        stringency_index: 
                            obj.stringency_index,
                        new_case_rate: 
                            obj.new_case_rate,
                        gdp_per_capita:
                            obj.gdp_per_capita,
                        population:
                            obj.population,
                        group: obj.location
                    })
                }
            }
        }
    }

    let update_axes = () => {
        /** Updates axes. */

        // update x axis
        data.sort((a, b) => d3.descending(
            a[cur_option[0]],b[cur_option[0]]
        ));
        let x_domain = data.map(obj => obj.group);
        x_scale.domain(x_domain);
        x_axis.transition().duration(1000)
              .call(d3.axisBottom(x_scale));

        // set color of tick line of selected country to red
        x_axis.selectAll("line")
              .attr("stroke-width", 3)
              .attr("stroke", d => {
                    let stroke_color = "black";
                    let code = selected_country.code;
                    if (code) {
                        let loc = locations_map.get(code).location;
                        if (d == loc) stroke_color = "red";
                    }
                    return stroke_color;
              });

        // display tick labels only if continents are
        // displayed since there are fewer continents.
        // else, show label of a tick only upon 
        // hovering over that tick
        if (data_received == false 
            && selected_country.path == null
        ){
            x_axis.selectAll("text")
                  .transition()
                  .duration(1000)
                  .attr("opacity", 1)
                  .attr("transform","translate(0,10)")
        } else {
            x_axis.selectAll("text")
                  .transition()
                  .duration(100)
                  .attr("opacity", 0)
                  .attr("transform","translate(0,10)")
        }

        // make label appear upon hovering over
        // tick line on x-axis
        x_axis.selectAll(".tick").select("line")
        .on("mouseover", (e,d) => {
            let tick = d3.select(e.path[1]);
            tick.select("text").attr("opacity", 1)
        }).on("mouseout", (e,d) => {
            if (!continents_map.get(d)) {
                let tick = d3.select(e.path[1]);
                tick.select("text").attr("opacity", 0);
            }
        });

        // update y axis
        let y_domain = d3.extent(
            Array.from(data.values())
            .map(obj => obj[cur_option[0]])
        );
        y_scale.domain(y_domain);
        y_axis.transition().duration(1000)
              .call(d3.axisLeft(y_scale).ticks(5));
    }

    let show_label = (d) => {
        /** Makes overlay over the cluster layout
         *  visible with given data displayed on it. */
        let tooltip = d3.select("#cluster_layout").select(".tooltip");
        let tt_rect = tooltip.select("rect");
        tt_rect.transition().duration(1000).attr("opacity", 0.95);
        tooltip.selectAll("text").data([
                ["Region", d.group],
                [cur_option[1], Math.round(d[cur_option[0]]*1000)/1000]
            ])
            .join("text").attr("fill", color_light)
            .text(d => `${d[0]} = ${d[1]}`)
            .attr("transform", (d,i) => 
                `translate(${width_px/3},${height_px/2+(i*25)})`
            ).transition().duration(1000).attr("opacity", 1);
        tooltip.raise(); // bring overlay to the front
    }
    
    let hide_label = () => {
        /** Makes overlay over the cluster layout disappear. */
        let tooltip = d3.select("#cluster_layout").select(".tooltip");
        let tt_rect = tooltip.select("rect");

        // make tooltip disappear
        tooltip.selectAll("text")
               .transition().duration(1000)
               .attr("opacity", 0);
        tt_rect.transition().duration(1000).attr("opacity", 0);
        tooltip.lower(); // take overlay to the back
    }

    let update_bars = () => {
        /** Updates bars of the graph */
        let bars = svg.selectAll(".bar").data(data);
        bars.enter()
            .append("rect").attr("class", "bar")
            .on("mouseover", (e,d) => show_label(d))
            .on("mouseout", hide_label)
            .merge(bars).transition()
            .duration(1000).attr("opacity", 1)
            .attr("x", d => { console.log(d); return x_scale(d.group)})
            .attr("y", d => y_scale(d[cur_option[0]]))
            .attr("width", x_scale.bandwidth())
            .attr("height", d => 
                height_px-y_scale(d[cur_option[0]])-margin.bottom
            )
            .attr("stroke-width", 1)
            .attr("stroke", color_dark)
            .attr("fill", color_medium)
        bars.exit()
            .transition()
            .duration(1000)
            .attr("opacity",0)
            .attr("height",0)
            .attr("width",0)
            .remove();
    }

    let data = null;
    let data_received = false;
    let update = (filtered_data) => {
        // if specific countries whose data to 
        // display has been provided as 
        // filtered_data, then display this data
        // and set data_received flag to true
        if (filtered_data) {
            data_received = true;
            data = filtered_data;
        }
        // else follow protocol and display either
        // data grouped by continent or by 
        // nations within a continent
        else {
            data_received = false;
            filter_region()
        };

        // update axes and bars as per latest set data
        update_axes();
        update_bars();
    }

    // filter data on bar layout
    // accordingly every time a new
    // dropdown option is selected
    dropdown.on("change", (e, d) => {
        // get chosen option
        let src_elem = d3.select(e.srcElement);
        let val = src_elem.property("value");
        // get display name of the selected 
        // option from its variable name
        let name = val.split("_");
        name = name.map(n => 
            n.charAt(0).toUpperCase() + n.slice(1)
        )
        name = name.join(" ")

        // set option as currently selected option
        cur_option = [val, name];

        // update data on bar layout
        if (data_received) update(data);
        else update();
    });

    obj.update = update;

    return obj;
}

// CLUSTER LAYOUT
var cluster_layout = null;
const make_cluster_layout = () => {
    /** Makes and adds cluster layout. */
    let obj = {};
    
    // add svg
    let svg = d3.select("#cluster_layout").append("svg");

    // get dimensions of svg in pixels
    let width_px = Number(svg.style("width").replace("px", ""));
    let height_px = Number(svg.style("height").replace("px", ""));

    let margin = {left:60, right:30, top:20, bottom:40};

    // add axes
    let x_scale = d3.scaleLinear()
        .range([margin.left, width_px-margin.right]);
    
    let y_scale = d3
        .scaleLinear()
        .range([height_px-margin.bottom, margin.top]);

    // color and radius scale
    let gdp_range = split_range(
        extents.gdp_per_capita[0],
        extents.gdp_per_capita[1],
        4
    );

    let color_scale = (gdp_pc) => {
        if (gdp_pc > gdp_range[2]) return "#9d00ff";
        else if (gdp_pc > gdp_range[1]) return "#00d0ff";
        else return "#ffffff";
    }

    let radius_scale = d3.scaleLinear()
                         .domain(extents.gdp_per_capita)
                         .range([5,30]); 

    // create display for bar layout to use
    let ttg = svg.append("g")
                 .attr("class", "tooltip");
    ttg.append("rect")
       .attr("fill", color_dark)
       .attr("width", width_px)
       .attr("height", height_px)
       .attr("opacity", 0);
    ttg.lower(); // send to back

    // set options for t-SNE
    // clustering algorithm
    let opt = {}
    opt.epsilon = 20; // lr
    opt.perplexity = 30;
    opt.dim = 2; // output dims

    let get_data_for_tsne = () => {
        /** Updates data to be in a format suited for t-sne
         *  algorithm implementation used here. */
        X = Array.from(
            useful_data.values()
        ).map(r => {
            // give 4 variables indicating  
            // national efforts to reduce spread of 
            // covid as input to the t-SNE algorithm
            return [
                r.vaccination_rate,
                r.booster_rate,
                r.handwashing_facilities,
                r.stringency_index
            ]
        });
        return X;
    }

    let run_tsne = ({n, X}) => {
        /** Runs t-SNE algorithm with given
         *  data X for n iterations. */

        // create a t-sne instance
        let tsne = new tsnejs.tSNE(opt);

        // initialize tsne
        tsne.initDataRaw(X);

        // run for n iterations
        for(let i=0; i<n; i++) {tsne.step();}
        let tsne_points = tsne.getSolution();
        let values = Array.from(useful_data.values());

        // update data
        data = [];
        for (let i=0; i<values.length; i++){
            let v = values[i];
            data.push({
                code: v.iso_code,
                location: v.location,
                gdp_per_capita: v.gdp_per_capita,
                point: tsne_points[i],
                stringency_index: v.stringency_index,
                handwashing_facilities:v.handwashing_facilities,
                vaccination_rate: v.vaccination_rate,
                booster_rate: v.booster_rate,
                continent: v.continent,
                population: v.population,
                new_case_rate: v.new_case_rate
            });
        }
    }

    let update_axes = () => {
        /** Updates axes based
         *  on latest data. */
        let x_extent = d3.extent(data.map(d=>d.point[0]));
        let y_extent = d3.extent(data.map(d=>d.point[1]));
        x_scale.domain(x_extent);
        y_scale.domain(y_extent);
    }

    let plot_points = () => {
        /** Plots points received upon running tsne */
        // add circles using points output by t-SNE algorithm
        // upon being given vaccination_Rate, booster_rate
        // handwashing_facilities and stringency_index as input
        let points = svg.selectAll("circle").data(data);
        points.enter().append("circle")
            .merge(points)
            .attr("id", d => `point_${d.code}`)
            .transition().duration(1000)
            .attr("opacity", 0.6)
            .attr("cx", d => x_scale(d.point[0]))
            .attr("cy", d => y_scale(d.point[1]))
            // set radius and color based on gdp_per_capita
            .attr("r", d => radius_scale(d.gdp_per_capita))
            .attr("fill", d => color_scale(d.gdp_per_capita))
            .attr("stroke", color_dark);
        points.exit().transition().duration(1000)
              .attr("r", 0).remove();
    }

    let show_labels = (c, d) => {
        /** Displays data (d) associated with
         *  current highlighted circle (c) on the 
         *  cluster layout using an overlay 
         *  over the bar layout. */
        
        // remove dropdown
        d3.select("#bar_layout")
          .select("select")
          .attr("disabled", true);

        // highlight circle 
        c.attr("stroke-width", 5)
         .attr("stroke", color_accent);

        // display text
        let tooltip = d3.select("#bar_layout")
                        .select(".tooltip");

        // get overlay from bar layout 
        // in which to display data
        let tt_rect = tooltip.select("rect");
        tt_rect.transition().duration(1000)
               .attr("opacity", 0.9);
        
        // bind data to display
        tooltip.selectAll("text")
        .data([
            ["New Case Rate", Math.round(
                d.new_case_rate
            *1000)/1000],
            ["Vaccination Rate", Math.round(
                d.vaccination_rate
            *1000)/1000],
            ["Booster Rate", Math.round(
                d.booster_rate
            *1000)/1000],
            ["Stringency Index", Math.round(
                d.stringency_index
            *1000)/1000],
            ["Handwashing Facilities", Math.round(
                d.handwashing_facilities
            *1000)/1000],
            ["GDP Per Capita", Math.round(
                d.gdp_per_capita
            *1000)/1000]
        ])
        // display data as text on overlay
        .join("text")
        .attr("fill", color_light)
        .text(d => `${d[0]} = ${d[1]}`)
        .transition()
        .duration(1000)
        .attr("opacity", 1)
        .attr("transform", (d,i) => 
            `translate(${20},${height_px/5+(i*20)})`
        );

        // bring tooltip to front
        tooltip.raise();
    }

    let hide_labels = (c, d) => {
        /** Hides values. */

        // set highlighted circle back to normal
        c.attr("stroke-width", 1)
         .attr("stroke", color_dark);

        // enable dropdown
        d3.select("#bar_layout")
          .select("select")
          .attr("disabled", null);

        // make tooltip disappear
        let tooltip = d3.select("#bar_layout")
                        .select(".tooltip");

        let tt_rect = tooltip.select("rect");

        tooltip.selectAll("text")
               .transition()
               .duration(1000)
               .attr("opacity", 0)
               .attr("transform", `translate(${0},${0})`);

        tt_rect.transition()
               .duration(1000)
               .attr("opacity", 0);

        tooltip.lower();
    }

    obj.focus_country = () => {
        /** Focuses on currently selected country. */

        // set all selected back to normal
        // in case any one was already highlighted
        let circles = svg.selectAll("circle");
        circles.on('mouseover', null).on("mouseout", null);
        circles.data(data).transition().duration(1000)
            .attr("fill", d => color_scale(d.gdp_per_capita))
            .attr("r", d => radius_scale(d.gdp_per_capita));
    
        if (
            selected_country.code
            && useful_data.get(selected_country.code)
        ) {
            // highlight circle
            let c = svg.select("#point_"+
                selected_country.code 
            );

            c.on("mouseover", (e,d) => {
                show_labels(c, d);
            }).on("mouseout", (e,d) => {
                hide_labels(c, d);
            });

            // highlight circle
            c.transition()
                .duration(1000)
                .attr("r", 100)
                .attr("fill", "red");
        }
    }

    // brushing
    let is_brushed = (brush_coords, cx, cy) => {
        /**  Returns TRUE if a dot is brushed
         *   and FALSE otherwise. */
        var x0 = brush_coords[0][0],
            x1 = brush_coords[1][0],
            y0 = brush_coords[0][1],
            y1 = brush_coords[1][1];
        return x0 <= cx 
            && cx <= x1 
            && y0 <= cy 
            && cy <= y1;  
    }

    let update_bar_layout = () => {
        /** Changes bar layout to show data of countries
         *  associated with selected circles. */
        if (sel_data.length != 0) bar_layout.update(sel_data);
        else bar_layout.update();
    }

    let brush_update = (e) => {
        /** Triggered upon brushing. */

        // set any previously set
        // toggled data points 
        // back to normal
        svg.selectAll("circle")
            .transition()
            .duration(1000)
            .attr("stroke", color_dark)
            .attr("stroke-width", 1);

        d3.select("#map_layout")
            .selectAll("path")
            .transition()
            .duration(1000)
            .attr("transform", "scale(1)");

        // get brush selection box dims
        let selection_box = e.selection;

        // get selected countries
        // and update map layout 
        sel_data = [];
        let sel_countries = [];

        // highlight brushed circles and
        // determined countries selected 
        // through brushing
        svg.selectAll("circle")
        .each(d => {
            let c = d3.select(`#point_${d.code}`);
            if (c) {
                let b = is_brushed(
                    selection_box,
                    c.attr("cx"),
                    c.attr("cy")
                );
                if (b) {
                    c.transition()
                    .duration(1000)
                    .attr("stroke",color_accent)
                    .attr("stroke-width",2);
                    d.group = d.location;
                    sel_data.push(d);
                    sel_countries.push(d.code);
                }
            }
        });

        // determine countries not selected and 
        // remove them from map layout
        if (sel_data.length > 0) {
            let not_sel_countries = 
            Array.from(locations_map.keys())
                .filter(code => 
                    !sel_countries.includes(code)
                );
            let ml = d3.select("#map_layout");
            not_sel_countries.forEach(c => {
                let p = ml.select(`#path_${c}`);
                p.transition()
                .duration(1000)
                .attr("transform","scale(0,0)")
            });
        }

        // update bar layout to display data 
        // associated with selected countries 
        update_bar_layout();
    }

    // add brushing interaction
    svg.call(d3.brush()
        .extent([[0,0],[width_px,height_px]]) 
        .on("start brush", brush_update)
    )

    let data = null;
    let sel_data = [];
    obj.update = () => {
        /** Updates this layout. */
        let X = get_data_for_tsne();
        run_tsne({n:100, X:X});
        update_axes();
        plot_points();
    }

    // add legend
    let legend = d3.select("#cluster_layout")
                   .append("svg")
                   .attr("class", "legend");

    let legend_data = [
        [
            "low gdp",
            color_scale(gdp_range[0]+10),
            radius_scale(gdp_range[0]+10)
        ], [
            `med gdp`,
            color_scale(gdp_range[1]+10),
            radius_scale(gdp_range[1]+10)
        ],
        [
            `high gdp`,
            color_scale(gdp_range[2]+10),
            radius_scale(gdp_range[2]+10)
        ]
    ]

    let legend_w = Number(legend.style("width").replace("px", ""));
    let legend_h = Number(legend.style("height").replace("px", ""));

    legend.append("text")
        .attr("fill", color_accent)
        .attr("transform",`translate(${legend_w/2-25},50)`)
        .text("LEGEND");

    let legend_text = legend.append("text")
    .attr(
        "transform",`translate(${legend_w/2-25},${legend_h-20})`
    )
    .attr("opacity", 0)
    .attr("fill", "white");
    
    // add sample circles
    legend.selectAll("circle")
    .data(legend_data)
    .join("circle")
    .attr("fill", d=>d[1])
    .attr("r", d=>d[2])
    .attr("cx", legend_w/2)
    .attr("cy", legend_h/3.5)
    .attr(
        "transform", (d,i) => 
        `translate(0,${(i+2)*d[2]})`
    )
    .attr("stroke-width", 0)
    .attr("opacity", 0.4)
    .attr("stroke", color_medium)
    // display circle value on hover
    .on("mouseover", (e,d) => {
        console.log(d[0]);
        legend_text
            .transition()
            .duration(500)
            .attr("opacity",1)
            .text(d[0]);
    }).on("mouseout", (e,d) => {
        legend_text
            .transition()
            .duration(500)
            .attr("opacity",0);
    });

    // add info "i" button
    legend.append("svg")
        .attr("x", legend_w-25)
        .attr("y", 5)
        .append("image")
        .attr("id", "info_button") 
        .attr(
            "href", 
            "https://cdn-icons-png"
            +".flaticon.com/512/189"
            +"/189664.png"
        )
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", "white")
        .on("click", () => {
            alert(
                "Attributes 'Vaccination Rate', "
                + "'Booster Rate', 'Stringency "
                + "Index' and 'Handwashing Facilities' "
                + "Visualized using T-SNE "
                + "Algorithm for Cluster Analysis "
            )
        });

    return obj;
}

// LOAD DATA & TIMELINE
const update_useful_data = () => {
    /** Rolls up data over time per country and extracts
     *  or calculates data to be visualized. */
    useful_data = d3.rollup(
        [...data_cur_time], 
        row => ({
            // calculate new case rate
            new_case_rate: (
                d3.sum(row,d=>d.new_cases)
                /d3.mean(row,d=>d.population)
            )*100||0,
            // calculate vaccination rate
            vaccination_rate: (
                d3.sum(row,d=>d.new_vaccinations)
                /d3.mean(row,d=>d.population)
            )*100||0,
            // calculate booster rate
            booster_rate: (
                d3.max(row,d=>d.total_boosters)
                /d3.mean(row,d=>d.population)
            )*100||0,
            // calculate average stringency_index
            stringency_index:
                d3.mean(row,d=>d.stringency_index)||0,
            // calculate average handwashing_facilities
            handwashing_facilities:
                d3.mean(row,d=>d.handwashing_facilities)||0,
            // calculate average gdp_per_capita
            gdp_per_capita: 
                d3.mean(row,d=>d.gdp_per_capita)||0,
            // extract continent that this country is a part of
            continent: d3.max(row,d=>d.continent),
            // extract name of this country
            location: d3.max(row,d=>d.location),
            // calculate average population
            population: d3.mean(row,d=>d.population),
            // save iso code of this country
            iso_code: d3.max(row,d=>d.iso_code)
        }),
        row => row.iso_code
    )
}

const load = () => {
    /** Loads data and layouts. */
    Promise.all([
        // load covid-19 data
        d3.csv("../data/useful_data.csv",d3.autoType),
        // load geojson data
        d3.json(
            "https://raw.githubusercontent.com"
            + "/holtzy/D3-graph-gallery/master"
            + "/DATA/world.geojson"
        )
    ]).then(data_loaded => {
        // assign loaded data to appropriate variables
        data_covid = data_loaded[0];
        data_geojson = data_loaded[1];
        data_cur_time = Object.assign([], data_covid);

        // get years that the data spans
        let years_set = new Set();
        data_covid.map(row => years_set.add(
            row.date.getFullYear()
        ));
        years = Array.from(years_set);

        // calculate and assign values that are to 
        // be displayed on the dashboard
        update_useful_data();

        // calculate extent of all numeric variables
        extents = {
            vaccination_rate: d3.extent(
                useful_data.values(), 
                d => d.vaccination_rate
            ),
            booster_rate: d3.extent(
                useful_data.values(), 
                d => d.booster_rate
            ),
            handwashing_facilities: d3.extent(
                useful_data.values(), 
                d => d.handwashing_facilities
            ),
            new_case_rate: d3.extent(
                useful_data.values(), 
                d => d.new_case_rate
            ),
            stringency_index: d3.extent(
                useful_data.values(), 
                d => d.stringency_index
            ),
            gdp_per_capita: d3.extent(
                useful_data.values(), 
                d => d.gdp_per_capita
            )
        }

        // store mapping countries to their code
        data_covid.forEach(
            row => locations_map.set(
                row.iso_code, { 
                code: row.iso_code,
                location: row.location,
                continent: row.continent
            })
        )

        // map continents to list of countries within
        continents_map = d3.group(
            Array.from(locations_map.values()),
            d=>d.continent
        );
        for (let [k,v] of continents_map) {
            continents_map.set(k,v.map(o=>o.code))
        }

        // filter geojson data so that regions without
        // covid data like say antarctica is not in it
        let valid_locations = Array.from(locations_map.keys())
        data_geojson.features = data_geojson.features.filter(
            f => valid_locations.includes(f.id)
        );

        // load layouts
        map_layout = make_map_layout();
        bar_layout = make_bar_layout();
        cluster_layout = make_cluster_layout();
        make_timeline();
    });
}

load();

// LISTEN FOR DATA CHANGE
document.getElementById('time_display').addEventListener(
    'DOMSubtreeModified', () => {
        update_useful_data();
        map_layout.update();
        bar_layout.update();
        cluster_layout.update();
    }
);