/*
Copyright 2005 - 2021 Advantage Solutions, s. r. o.

This file is part of ORIGAM (http://www.origam.org).

ORIGAM is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

ORIGAM is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with ORIGAM. If not, see <http://www.gnu.org/licenses/>.
*/

import { observable } from "mobx";
import React from "react";
import S from './LineChartPlugin.module.scss';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, LineController,CategoryScale,Legend, LineElement, Tooltip,PointElement, LinearScale } from 'chart.js';
ChartJS.register(LineController, LineElement,CategoryScale, Legend,PointElement, Tooltip,LinearScale);

import moment from "moment";
import {
  ILocalization,
  ILocalizer,
  ISectionPluginData,
  IPluginTableRow,
  ISectionPlugin
} from "@origam/plugins";
import { csToMomentFormat } from "@origam/utils";

const seriesLabelFieldName = "SeriesLabelField";
const seriesValueFieldsName = "SeriesValueFields";
const filterFieldName = "FilterField";
const noDataMessageName = "NoDataMessage";
const axisMinName = "AxisMin";
const axisMaxName = "AxisMax";
const stepSizeName = "StepSize";
const labelFormatName = "LabelFormat";
const lineColorName = "LineColor";

export class LineChartPlugin implements ISectionPlugin {
  $type_ISectionPlugin: 1 = 1;
  id: string = ""
  seriesValueFields: string | undefined;
  seriesLabelField: string | undefined;
  noDataMessage: string | undefined;
  filterField: string | undefined;
  axisMin: number | undefined;
  axisMax: number | undefined;
  stepSize: number | undefined;
  labelFormat: string | undefined;
  lineColor: string | undefined;
  labels: string[] = [];

  @observable
  initialized = false;
  createLocalizer: ((localizations: ILocalization[]) => ILocalizer) | undefined;

  initialize(xmlAttributes: { [key: string]: string }): void {
    this.seriesValueFields = this.getXmlParameter(xmlAttributes, seriesValueFieldsName);
    this.lineColor = this.getXmlParameter(xmlAttributes, lineColorName);
    this.seriesLabelField = this.getXmlParameter(xmlAttributes, seriesLabelFieldName);
    this.noDataMessage = this.getXmlParameter(xmlAttributes, noDataMessageName);
    this.filterField = xmlAttributes[filterFieldName];
    this.labelFormat = xmlAttributes[labelFormatName];
    this.axisMin = this.getPositiveNumericParameter(xmlAttributes, axisMinName);
    this.axisMax = this.getPositiveNumericParameter(xmlAttributes, axisMaxName);
    this.stepSize = this.getPositiveNumericParameter(xmlAttributes, stepSizeName);
    this.initialized = true;
  }

  onSessionRefreshed(): void {
  }

  getXmlParameter(xmlAttributes: { [key: string]: string }, parameterName: string) {
    if (!xmlAttributes[parameterName]) {
      throw new Error(`Parameter ${parameterName} was not found. Cannot plot anything.`)
    }
    return xmlAttributes[parameterName];
  }

  getPositiveNumericParameter(xmlAttributes: { [key: string]: string }, parameterName: string) {
    let value = xmlAttributes[parameterName];
    if (!value || value.trim() === "") {
      return undefined;
    }
    const number = Number(value);
    return (isNaN(number) || number < 0) ? undefined : number;
  }

  getLabel(data: ISectionPluginData, row: IPluginTableRow): string {
    const property = this.getProperty(data, this.seriesLabelField!)

    let cellValue = data.dataView.getCellValue(row, property.id);
    if (property.type === "Date") {
      const format = csToMomentFormat(this.labelFormat) ?? property.momentFormatterPattern
      if(this.createLocalizer)
      {
        const localizer = this.createLocalizer([]);
        return moment(cellValue).locale(localizer.locale).format(format);
      }
      return moment(cellValue).format(format);
    } else {
      return (cellValue ?? "").toString();
    }
  }

  getUniqueLabel(data: ISectionPluginData, row: IPluginTableRow) {
    let newLabel = this.getLabel(data, row);
    let numberOfDuplicates = this.labels.filter(label => label === newLabel).length;
    if (numberOfDuplicates > 0) {
      newLabel = `${newLabel}(${numberOfDuplicates})`;
    }
    this.labels.push(newLabel);
    return newLabel;
  }

  getProperty(data: ISectionPluginData, propertyId: string) {
    const property = data.dataView.properties.find(prop => prop.id === propertyId)
    if (!property) {
      throw new Error(`Property ${propertyId} was not found`)
    }
    return property;
  }

  generateData( data: ISectionPluginData, column: string) {
    return data.dataView.tableRows
       .map(row => 
             data.dataView.getCellValue(row, column)
         );
   }
   
  getComponent(data: ISectionPluginData, createLocalizer: (localizations: ILocalization[]) => ILocalizer): JSX.Element {
    this.createLocalizer = createLocalizer;
    if (!this.initialized) {
      return <></>;
    }
    this.labels = data.dataView.tableRows
      .map(row => this.getUniqueLabel(data, row));
    const listDataSets  = 
      this.seriesValueFields!
      .split(";")
      .map(propertyId => 
        {
          const lineName = this.getProperty(data, propertyId.trim());
          const index = this.seriesValueFields?.split(";").indexOf(propertyId)??0;
          const color = this.lineColor?.split(";")[index]??"#000000";
          return {
              label: lineName.name, 
              data: this.generateData(data, lineName.id),
              backgroundColor: color??0,
              borderColor: color??0,
              borderWidth: 1,
              radius: 0
          }
        }
      );
    if (listDataSets.length === 0) {
      return <div className={S.noDataMessageContainer}>{this.noDataMessage}</div>
    }
    return (
      <div className={S.chartContainer}>
        <Chart type='line'
          data={{
            labels: this.labels,
            datasets: listDataSets,
          }}
          options={
            {
              maintainAspectRatio: false,
              scales:{
                x: {
                  ticks:{
                    maxTicksLimit: this.stepSize,
                    maxRotation: 0,
                    minRotation: 0
                  }
                },
                y: {
                  beginAtZero: this.axisMin === 0,
                  suggestedMin: this.axisMin,
                  suggestedMax: this.axisMax,
                }
              },
              plugins:
              {
                tooltip:
                {
                  mode: 'index',
                  axis: 'xy',
                  intersect: false
                }
              }
            }
          }
          className={S.chart}
        />
      </div>
    );
  }

  @observable
  getScreenParameters: (() => { [parameter: string]: string }) | undefined;
}