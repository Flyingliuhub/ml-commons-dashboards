/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useCallback, useState } from 'react';
import {
    EuiButton,
    EuiFormRow,
    EuiTitle,
    EuiSelect,
    EuiSpacer,
    EuiPageHeader,
    EuiFilePicker,
    EuiRadioGroup,
    EuiText,
} from '@elastic/eui';
import { SUPPORTED_ALGOS, ALGOS } from '../../../common/algo'
import { APIProvider } from '../../apis/api_provider';
import { ComponentsCommonProps } from '../app'
import { parseFile, transToInputData } from '../../../public/utils'
import { ParsedResult } from '../data/parse_result';
import { QueryField, type Query } from '../data/query_field';
import { useIndexPatterns } from '../../hooks'
import { type DataSource } from '../../apis/train'
import './index.scss'
import { TrainResult } from './train_result'
import { TrainForm } from './train_form'

interface Props extends ComponentsCommonProps {

}

export interface TrainingResult {
    status: 'success' | 'fail' | ''
    id?: string
    message?: string
}

export const Train = ({ data }: Props) => {
    const [selectedAlgo, setSelectedAlgo] = useState<ALGOS>('kmeans')
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCols, setSelectedCols] = useState<number[]>([])
    const [files, setFiles] = useState([{}])
    const [dataSource, setDataSource] = useState<DataSource>('upload')
    const { indexPatterns } = useIndexPatterns(data);
    const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>({})
    const [query, setQuery] = useState<Query>()
    const [trainingResult, setTrainingResult] = useState<TrainingResult>({ status: '' })

    const generateDefaultParams = useCallback((algo: string) => {
        const result: Record<string, string | number> = {}
        const selectAlgo = SUPPORTED_ALGOS.find(item => item.value === algo)
        selectAlgo?.parameters?.forEach(item => {
            result[item.name] = item.default
        })
        return result
    }, [])
    const defaultParams = generateDefaultParams('kmeans')
    const [params, setParams] = useState(defaultParams);

    const [parsedData, setParsedData] = useState({
        data: []
    });

    const onChange = (files) => {
        setFiles(files.length > 0 ? Array.from(files) : []);
        setParsedData({
            data: []
        })
        if (files[0]) {
            parseFile(files[0], (data) => {
                setParsedData(data);
            })
        }

    };

    const handleSelectAlgo = (algo: ALGOS) => {
        setSelectedAlgo(algo);
        setParams(generateDefaultParams(algo))
    };

    const renderFiles = () => {
        if (files.length > 0) {
            return (
                <ul>
                    {files.map((file, i) => (
                        <li key={i}>
                            <strong>{file.name}</strong> ({file.size} bytes)
                        </li>
                    ))}
                </ul>
            );
        } else {
            return (
                <p>Add some files to see a demo of retrieving from the FileList</p>
            );
        }
    };


    const handleBuild = useCallback(async (e) => {
        console.log('params', params)
        setTrainingResult({ status: "", id: '', message: '' })
        setIsLoading(true);
        e.preventDefault();
        const input_data = transToInputData(parsedData.data, selectedCols);
        let result
        try {
            const body = APIProvider.getAPI('train').convertParams(selectedAlgo, dataSource, params, input_data, { fields: selectedFields, query });
            result = await APIProvider.getAPI('train').train(body)
            const { status, model_id, message } = result;
            if (status === "COMPLETED") {
                setTrainingResult({ status: "success", id: model_id })
            } else if (message) {
                setTrainingResult({ status: "fail", message })
            }
        } catch (e) {
            console.log('error', e)
        }
        setIsLoading(false)
    }, [params, selectedAlgo, selectedFields, parsedData, selectedCols, dataSource, query])
    return (
        <>
            <EuiPageHeader pageTitle="Train model" bottomBorder />
            <div className='ml-train-form'>
                <EuiTitle size="xs">
                    <h4>Select a algorithm</h4>
                </EuiTitle>
                <EuiSelect
                    onChange={(e) => { handleSelectAlgo(e.target.value as ALGOS) }}
                    value={selectedAlgo}
                    fullWidth
                    options={
                        SUPPORTED_ALGOS.map(item => ({ value: item.value, text: item.text }))
                    }
                />
                <EuiSpacer />
                <EuiTitle size="xs">
                    <h4>Parameters</h4>
                </EuiTitle>
                <TrainForm params={params} setParams={setParams} algo={selectedAlgo} />
                <EuiSpacer />
                <EuiTitle size="xs">
                    <h4>Training Data</h4>
                </EuiTitle>
                <EuiRadioGroup
                    options={[
                        {
                            id: 'upload',
                            label: 'Upload File',
                        },
                        {
                            id: 'query',
                            label: 'Query From OpenSearch'
                        }
                    ]}
                    idSelected={dataSource}
                    onChange={(id) => setDataSource(id as DataSource)}
                />
                <EuiSpacer />
                {
                    dataSource === 'upload' ? (
                        <>
                            <EuiFormRow label="File picker" fullWidth>
                                <EuiFilePicker
                                    initialPromptText="upload CSV or JSON data"
                                    display='large'
                                    onChange={onChange}
                                    fullWidth
                                />
                            </EuiFormRow>
                            <EuiText>
                                <h5>Files attached</h5>
                                {renderFiles()}
                            </EuiText>
                            {
                                parsedData?.data?.length > 0 ? <ParsedResult data={parsedData.data} selectedCols={selectedCols} onChangeSelectedCols={setSelectedCols} /> : null
                            }
                        </>
                    ) : <QueryField indexPatterns={indexPatterns} selectedFields={selectedFields} onSelectedFields={setSelectedFields} onUpdateQuerys={setQuery} />
                }
                <EuiSpacer />
                <EuiButton color="primary" fill onClick={handleBuild} isLoading={isLoading}>
                    Build Model
                </EuiButton>
                <TrainResult trainingResult={trainingResult} />
            </div>
        </>
    );
};