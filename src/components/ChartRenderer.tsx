import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: any[];
  config?: any;
}

export const ChartRenderer = ({ data }: { data: ChartData }) => {
  const COLORS = ['#F0EFEB', '#112250', '#4A5568', '#CBD5E0', '#2D3748'];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-72 bg-white/5 border border-white/10 rounded-2xl p-6 my-6 overflow-hidden"
    >
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cream/40 mb-4">{data.title}</h4>
      <ResponsiveContainer width="100%" height="85%">
        {data.type === 'bar' ? (
          <BarChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240, 239, 235, 0.05)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="rgba(240, 239, 235, 0.4)" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="rgba(240, 239, 235, 0.4)" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#141416', border: '1px solid rgba(240, 239, 235, 0.1)', borderRadius: '12px', fontSize: '10px' }}
              itemStyle={{ color: '#F0EFEB' }}
            />
            <Bar dataKey="value" fill="#F0EFEB" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : data.type === 'line' ? (
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240, 239, 235, 0.05)" vertical={false} />
            <XAxis dataKey="name" stroke="rgba(240, 239, 235, 0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(240, 239, 235, 0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#141416', border: '1px solid rgba(240, 239, 235, 0.1)', borderRadius: '12px', fontSize: '10px' }}
            />
            <Line type="monotone" dataKey="value" stroke="#F0EFEB" strokeWidth={2} dot={{ fill: '#F0EFEB', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data.data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {(data.data || []).map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#141416', border: '1px solid rgba(240, 239, 235, 0.1)', borderRadius: '12px', fontSize: '10px' }}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
};
