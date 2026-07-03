import {
  BarChart, LineChart, ScatterChart, PieChart,
  Bar, Line, Scatter, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#6366f1','#06b6d4','#f59e0b','#ec4899','#10b981','#8b5cf6','#ef4444','#0ea5e9']

export default function InlineChart({ spec, data, height = 260 }) {
  if (!spec || !data || data.length === 0) return null

  if (spec.chart_type === 'kpi') {
    return <KpiCard data={data} />
  }

  return (
    <div className="inline-chart__wrap">
      <ResponsiveContainer width="100%" height={height}>
        {renderChart(spec, data)}
      </ResponsiveContainer>
    </div>
  )
}

function KpiCard({ data }) {
  const item = data[0] || {}
  const value = item.value
  const formatted = typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value
  return (
    <div className="kpi-card">
      <div className="kpi-card__value">{formatted}</div>
      <div className="kpi-card__label">{item.label}</div>
    </div>
  )
}

function renderChart(spec, data) {
  const { chart_type, x, y, stack_by } = spec
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
  const axisStyle = { fontSize: 11, fill: '#94a3b8' }
  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }

  const stackKeys = (chart_type === 'bar_stacked_v' || chart_type === 'bar_stacked_h') && data.length > 0
    ? Object.keys(data[0]).filter(k => k !== x)
    : []

  switch (chart_type) {
    case 'line':
      return (
        <LineChart data={data}>
          {grid}
          <XAxis dataKey={x} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey={y} stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      )

    case 'scatter':
      return (
        <ScatterChart>
          {grid}
          <XAxis dataKey={x} tick={axisStyle} />
          <YAxis dataKey={y} tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Scatter data={data} fill={COLORS[0]} />
        </ScatterChart>
      )

    case 'pie':
      return (
        <PieChart>
          <Pie data={data} dataKey={y} nameKey={x} cx="50%" cy="50%" outerRadius={90}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      )

    case 'donut':
      return (
        <PieChart>
          <Pie data={data} dataKey={y} nameKey={x} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      )

    case 'bar_stacked_v':
      return (
        <BarChart data={data}>
          {grid}
          <XAxis dataKey={x} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {stackKeys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]}
              radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      )

    case 'bar_stacked_h':
      return (
        <BarChart data={data} layout="vertical">
          {grid}
          <XAxis type="number" tick={axisStyle} />
          <YAxis type="category" dataKey={x} tick={axisStyle} width={90} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {stackKeys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      )

    default: // bar
      return (
        <BarChart data={data}>
          {grid}
          <XAxis dataKey={x} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={y} radius={[6, 6, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      )
  }
}
