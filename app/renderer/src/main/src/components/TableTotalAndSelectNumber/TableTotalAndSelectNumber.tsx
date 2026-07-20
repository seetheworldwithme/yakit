import React from 'react'
import styles from './TableTotalAndSelectNumber.module.scss'
import { Divider } from 'antd'

interface TableTotalAndSelectNumberProps {
  total: number
  selectNum?: number
}
export const TableTotalAndSelectNumber: React.FC<TableTotalAndSelectNumberProps> = React.memo((props) => {
  const { total, selectNum } = props
  return (
    <div className={styles['table-total-select']}>
      <div className={styles['table-total-select-item']}>
        <span className={styles['table-total-select-text']}>总数</span>
        <span className={styles['table-total-select-number']}>{total}</span>
      </div>
      {selectNum !== undefined && (
        <>
          <Divider type="vertical" />
          <div className={styles['table-total-select-item']}>
            <span className={styles['table-total-select-text']}>已选</span>
            <span className={styles['table-total-select-number']}>{selectNum}</span>
          </div>
        </>
      )}
    </div>
  )
})
